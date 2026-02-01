"""
Intellecta RAG Backend - RAG Engine
RAG orchestrator with Fast mode (basic) and Quality mode (chain-of-thought + multi-pass).
Uses LLaMA 3.2 8B via Ollama for all LLM operations.
"""

import json
import logging
import re
import time
from typing import Any, Dict, List, Optional, Tuple

import httpx

from models import (
    QueryRequest, QueryResponse, SecurityInfo, KeywordInfo, RetrievalMetrics,
    SecurityLevel, Language
)
from retriever import retriever
from security import security_checker, SECURITY_LEVEL_VALUES
from embedding import embedding_model

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ===== Configuration =====

OLLAMA_BASE_URL = "http://localhost:11434"
LLM_MODEL = "llama3.2:latest"

# Keep alive setting: -1 means keep model loaded forever (reduces latency)
OLLAMA_KEEP_ALIVE = -1

# Generation settings
FAST_MODE_SETTINGS = {
    "temperature": 0.7,
    "top_p": 0.9,
    "num_predict": 1024,
    "num_ctx": 4096,
}

QUALITY_MODE_SETTINGS = {
    "temperature": 0.3,
    "top_p": 0.95,
    "num_predict": 2048,
    "num_ctx": 8192,
}

# Retrieval settings
FAST_TOP_K = 5
QUALITY_TOP_K = 10
QUALITY_EXPANDED_K = 15


class RAGEngine:
    """
    RAG orchestrator with dual-mode operation.
    - Fast Mode: Single-pass retrieval + basic prompt
    - Quality Mode: Chain-of-thought reasoning + query expansion + multi-pass retrieval
    """
    
    def __init__(self):
        self.ollama_url = OLLAMA_BASE_URL
        self.model = LLM_MODEL
        self._model_loaded = False
    
    async def check_ollama_connection(self) -> bool:
        """Check if Ollama is running and model is available."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.get(f"{self.ollama_url}/api/tags")
                if response.status_code == 200:
                    models = response.json().get("models", [])
                    model_names = [m.get("name", "") for m in models]
                    # Check if our model is available
                    if any(self.model in name for name in model_names):
                        self._model_loaded = True
                        return True
                    logger.warning(f"Model {self.model} not found. Available: {model_names}")
            return False
        except Exception as e:
            logger.error(f"Ollama connection error: {e}")
            return False
    
    async def warmup_model(self):
        """Pre-load the LLM for faster first query with keep_alive=-1."""
        try:
            logger.info(f"Warming up LLM: {self.model} with keep_alive=-1 (persistent)")
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": "Hello",
                        "options": {"num_predict": 1},
                        "keep_alive": OLLAMA_KEEP_ALIVE  # -1 = keep loaded forever
                    }
                )
                if response.status_code == 200:
                    self._model_loaded = True
                    logger.info("LLM warmup complete - model will stay loaded")
        except Exception as e:
            logger.error(f"LLM warmup failed: {e}")
    
    async def process_query(self, request: QueryRequest) -> QueryResponse:
        """
        Process a RAG query.
        
        Args:
            request: QueryRequest with query, language, security, etc.
            
        Returns:
            QueryResponse with answer, sources, metrics
        """
        start_time = time.time()
        
        # Determine mode
        fast_mode = request.fast_mode if request.fast_mode is not None else True
        
        logger.info(f"Processing query in {'Fast' if fast_mode else 'Quality'} mode")
        
        # Step 1: Extract keywords
        keywords = self._extract_keywords(request.query)
        
        # Step 2: Check query security
        query_level, matched_keyword = security_checker.check_query_security(request.query)
        
        # Step 3: Translate query if needed (for non-English)
        search_query = request.query
        if request.language != Language.ENGLISH:
            search_query = await self._translate_to_english(request.query)
            logger.info(f"Translated query: {search_query}")
        
        # Step 4: Retrieve relevant chunks
        if fast_mode:
            results, metrics = await self._fast_retrieval(
                query=search_query,
                document_ids=request.document_ids,
                security_clearance=request.security_clearance
            )
        else:
            results, metrics = await self._quality_retrieval(
                query=search_query,
                original_query=request.query,
                document_ids=request.document_ids,
                security_clearance=request.security_clearance
            )
        
        retrieval_time = (time.time() - start_time) * 1000
        
        # Step 5: Check content security and filter
        allowed_results, blocked_count = self._filter_by_security(
            results, 
            request.query,
            request.security_clearance
        )
        
        # Step 6: Determine effective security level
        if allowed_results:
            content_text = " ".join([r.get("text", "") for r in allowed_results[:3]])
            security_info = security_checker.dual_security_check(
                request.query, 
                content_text,
                request.security_clearance
            )
        else:
            security_info = SecurityInfo(
                level=query_level,
                level_value=SECURITY_LEVEL_VALUES[query_level],
                warning=None,
                matched_keyword=matched_keyword,
                access_allowed=True
            )
        
        # Step 7: Generate response
        gen_start = time.time()
        
        if not allowed_results:
            answer = "No relevant information found in the available documents for your query."
            sources = []
        elif not security_info.access_allowed:
            answer = f"Access denied. The requested information requires {security_info.level.value} clearance level."
            sources = []
        else:
            if fast_mode:
                answer = await self._generate_fast_response(
                    query=request.query,
                    context=allowed_results,
                    language=request.language
                )
            else:
                answer = await self._generate_quality_response(
                    query=request.query,
                    context=allowed_results,
                    language=request.language
                )
            
            sources = list(set([r.get("filename", "Unknown") for r in allowed_results]))
        
        generation_time = (time.time() - gen_start) * 1000
        
        # Step 8: Translate response if needed
        if request.language != Language.ENGLISH and answer and security_info.access_allowed:
            answer = await self._translate_response(answer, request.language)
        
        return QueryResponse(
            answer=answer,
            sources=sources,
            retrieval_time_ms=round(retrieval_time, 2),
            generation_time_ms=round(generation_time, 2),
            fast_mode=fast_mode,
            model_used=self.model,
            security=security_info,
            keywords=KeywordInfo(keywords=keywords, entities=[]),
            chunks_used=len(allowed_results),
            chunks_blocked=blocked_count,
            metrics=metrics
        )
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract important keywords from query."""
        # Remove common stop words
        stop_words = {
            "what", "where", "when", "how", "why", "who", "which",
            "is", "are", "was", "were", "be", "been", "being",
            "have", "has", "had", "do", "does", "did",
            "a", "an", "the", "and", "or", "but", "in", "on", "at",
            "to", "for", "of", "with", "by", "from", "as", "into",
            "can", "could", "will", "would", "should", "may", "might",
            "this", "that", "these", "those", "it", "its"
        }
        
        words = re.findall(r'\b\w+\b', query.lower())
        keywords = [w for w in words if w not in stop_words and len(w) > 2]
        
        return keywords[:10]  # Limit to 10 keywords
    
    async def _fast_retrieval(
        self,
        query: str,
        document_ids: Optional[List[str]],
        security_clearance: SecurityLevel
    ) -> Tuple[List[Dict], RetrievalMetrics]:
        """Fast mode: single-pass retrieval."""
        results, metrics = retriever.search(
            query=query,
            top_k=FAST_TOP_K,
            document_ids=document_ids,
            security_clearance=security_clearance,
            use_reranker=False  # Skip reranking in fast mode
        )
        return results, metrics
    
    async def _quality_retrieval(
        self,
        query: str,
        original_query: str,
        document_ids: Optional[List[str]],
        security_clearance: SecurityLevel
    ) -> Tuple[List[Dict], RetrievalMetrics]:
        """
        Quality mode: multi-pass retrieval with query expansion.
        1. Initial retrieval
        2. Query expansion based on initial results
        3. Second retrieval with expanded query
        4. Reranking
        """
        # First pass
        initial_results, _ = retriever.search(
            query=query,
            top_k=QUALITY_EXPANDED_K,
            document_ids=document_ids,
            security_clearance=security_clearance,
            use_reranker=False
        )
        
        # Extract key terms from initial results for query expansion
        if initial_results:
            expansion_terms = self._extract_expansion_terms(initial_results[:3])
            expanded_query = f"{query} {' '.join(expansion_terms)}"
            logger.info(f"Expanded query: {expanded_query}")
        else:
            expanded_query = query
        
        # Second pass with expanded query and reranking
        results, metrics = retriever.search(
            query=expanded_query,
            top_k=QUALITY_TOP_K,
            document_ids=document_ids,
            security_clearance=security_clearance,
            use_reranker=True  # Use reranker in quality mode
        )
        
        return results, metrics
    
    def _extract_expansion_terms(self, results: List[Dict]) -> List[str]:
        """Extract useful terms from results for query expansion."""
        text = " ".join([r.get("text", "")[:500] for r in results])
        
        # Find energy-related terms and technical terms
        patterns = [
            r'\b(\d+\s*(?:MW|GW|kW|MWh|kV|Hz))\b',  # Units
            r'\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b',  # Proper nouns
        ]
        
        terms = []
        for pattern in patterns:
            matches = re.findall(pattern, text)
            terms.extend(matches[:3])
        
        return list(set(terms))[:5]
    
    def _filter_by_security(
        self,
        results: List[Dict],
        query: str,
        user_clearance: SecurityLevel
    ) -> Tuple[List[Dict], int]:
        """Filter results by security clearance."""
        user_value = SECURITY_LEVEL_VALUES[user_clearance]
        allowed = []
        blocked = 0
        
        for result in results:
            chunk_level_str = result.get("security_level", "PUBLIC")
            try:
                chunk_level = SecurityLevel(chunk_level_str)
            except:
                chunk_level = SecurityLevel.PUBLIC
            
            chunk_value = SECURITY_LEVEL_VALUES[chunk_level]
            
            if user_value >= chunk_value:
                allowed.append(result)
            else:
                blocked += 1
        
        return allowed, blocked
    
    async def _generate_fast_response(
        self,
        query: str,
        context: List[Dict],
        language: Language
    ) -> str:
        """Generate response in fast mode with basic prompt."""
        context_text = self._format_context(context)
        
        prompt = f"""You are an expert assistant for energy sector document analysis. Answer the question based on the provided context.

Context:
{context_text}

Question: {query}

Instructions:
- Answer concisely and accurately based on the context
- If the answer is not in the context, say so
- Include specific data points when available

Answer:"""
        
        return await self._call_llm(prompt, FAST_MODE_SETTINGS)
    
    async def _generate_quality_response(
        self,
        query: str,
        context: List[Dict],
        language: Language
    ) -> str:
        """
        Generate response in quality mode with chain-of-thought reasoning.
        """
        context_text = self._format_context(context)
        
        prompt = f"""You are an expert assistant for energy sector document analysis. Use chain-of-thought reasoning to provide a comprehensive answer.

Context Documents:
{context_text}

Question: {query}

Instructions - Follow these steps:

Step 1: UNDERSTAND
- Identify the key aspects of the question
- Note any specific data, timeframes, or entities being asked about

Step 2: ANALYZE
- Review each relevant piece of context
- Identify connections between different pieces of information
- Note any patterns, trends, or significant findings

Step 3: SYNTHESIZE
- Combine information from multiple sources
- Draw logical conclusions based on the evidence
- Address all aspects of the question

Step 4: RESPOND
- Provide a clear, well-structured answer
- Include specific numbers, dates, and sources when available
- Acknowledge any limitations or uncertainties

Now, let's work through this step by step:

**Understanding the Question:**
"""
        
        response = await self._call_llm(prompt, QUALITY_MODE_SETTINGS)
        
        # Clean up the response to extract the final answer
        return self._extract_final_answer(response)
    
    def _format_context(self, results: List[Dict]) -> str:
        """Format context for LLM prompt."""
        context_parts = []
        for i, r in enumerate(results, 1):
            source = r.get("filename", "Unknown")
            text = r.get("text", "")
            score = r.get("score", 0)
            
            context_parts.append(f"[Source {i}: {source}]\n{text}\n")
        
        return "\n---\n".join(context_parts)
    
    def _extract_final_answer(self, response: str) -> str:
        """Extract the final answer from chain-of-thought response."""
        # Look for the response/answer section
        markers = ["**Response:**", "**Answer:**", "**Final Answer:**", "**Conclusion:**"]
        
        for marker in markers:
            if marker in response:
                parts = response.split(marker)
                if len(parts) > 1:
                    return parts[1].strip()
        
        # If no marker found, return the full response
        return response.strip()
    
    async def _translate_to_english(self, text: str) -> str:
        """Translate text to English for retrieval."""
        prompt = f"""Translate the following text to English. Only output the translation, nothing else.

Text: {text}

English translation:"""
        
        return await self._call_llm(prompt, {"temperature": 0.1, "num_predict": 256})
    
    async def _translate_response(self, text: str, target_language: Language) -> str:
        """Translate response to target language."""
        lang_names = {
            Language.KOREAN: "Korean",
            Language.VIETNAMESE: "Vietnamese"
        }
        
        target = lang_names.get(target_language, "English")
        
        prompt = f"""Translate the following text to {target}. Maintain the same meaning and tone. Only output the translation.

Text: {text}

{target} translation:"""
        
        settings = QUALITY_MODE_SETTINGS.copy()
        settings["num_predict"] = 2048
        
        return await self._call_llm(prompt, settings)
    
    async def _call_llm(self, prompt: str, settings: Dict) -> str:
        """Call Ollama LLM API with keep_alive=-1."""
        try:
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate",
                    json={
                        "model": self.model,
                        "prompt": prompt,
                        "stream": False,
                        "options": settings,
                        "keep_alive": OLLAMA_KEEP_ALIVE  # -1 = keep loaded forever
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    return result.get("response", "").strip()
                else:
                    logger.error(f"LLM API error: {response.status_code}")
                    return "Error generating response. Please try again."
                    
        except httpx.TimeoutException:
            logger.error("LLM request timed out")
            return "Request timed out. Please try again with a simpler query."
        except Exception as e:
            logger.error(f"LLM error: {e}")
            return f"Error: {str(e)}"
    
    def is_model_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._model_loaded


# ===== Global RAG Engine Instance =====

rag_engine = RAGEngine()


async def initialize_rag_engine():
    """Initialize the RAG engine."""
    connected = await rag_engine.check_ollama_connection()
    if connected:
        await rag_engine.warmup_model()
    return connected
