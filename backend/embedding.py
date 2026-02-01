"""
Intellecta RAG Backend - Embedding Module
Qwen3-VL-Embedding-2B and Qwen3-VL-Reranker-2B model loading and inference.
Supports multimodal (text + image) embeddings for vision-language retrieval.

CPU-optimized for systems without GPU.
"""

import os
import logging
from typing import List, Optional, Tuple, Union
import numpy as np

import torch
from transformers import AutoModel, AutoTokenizer

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ===== Configuration =====

EMBEDDING_MODEL_NAME = "Qwen/Qwen3-VL-Embedding-2B"  # 2B model for better quality embeddings
RERANKER_MODEL_NAME = "Qwen/Qwen3-Reranker-0.6B"     # 0.6B reranker (lighter, faster)

EMBEDDING_DIMENSIONS = 2048  # Qwen3-VL-Embedding-2B output dimension
MAX_SEQUENCE_LENGTH = 512
BATCH_SIZE = 2  # Small batch size for CPU

# Device configuration
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
logger.info(f"Using device: {DEVICE}")

# CPU optimizations
if DEVICE == "cpu":
    torch.set_num_threads(4)  # Limit CPU threads for efficiency


class EmbeddingModel:
    """
    Qwen3-Embedding model for generating document and query embeddings.
    Uses prefix convention: "query: " for queries, "passage: " for documents.
    CPU-optimized with AutoModel and AutoTokenizer.
    """
    
    def __init__(self, model_name: str = EMBEDDING_MODEL_NAME):
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self._loaded = False
        
    def load(self) -> bool:
        """Load the embedding model and tokenizer."""
        if self._loaded:
            return True
            
        try:
            logger.info(f"Loading embedding model: {self.model_name}")
            logger.info(f"This may take a few minutes on CPU...")
            
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                trust_remote_code=True
            )
            
            # Load model - for CPU use float32 and no device_map
            if DEVICE == "cpu":
                self.model = AutoModel.from_pretrained(
                    self.model_name,
                    trust_remote_code=True,
                    torch_dtype=torch.float32,
                    low_cpu_mem_usage=True
                )
                self.model.to(DEVICE)
            else:
                # GPU can use float16 and device_map
                self.model = AutoModel.from_pretrained(
                    self.model_name,
                    trust_remote_code=True,
                    torch_dtype=torch.float16,
                    device_map="auto"
                )
            
            self.model.eval()
            
            self._loaded = True
            logger.info(f"Embedding model loaded successfully on {DEVICE}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _get_text_embedding(self, text: str) -> Optional[torch.Tensor]:
        """Extract text embedding from the model output."""
        try:
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=MAX_SEQUENCE_LENGTH
            ).to(DEVICE)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                # Get last hidden state
                if hasattr(outputs, 'last_hidden_state'):
                    hidden_state = outputs.last_hidden_state
                else:
                    hidden_state = outputs[0]
                
                # Mean pooling over sequence
                attention_mask = inputs.get('attention_mask', torch.ones(hidden_state.shape[:2], device=DEVICE))
                mask_expanded = attention_mask.unsqueeze(-1).expand(hidden_state.size()).float()
                embedding = torch.sum(hidden_state * mask_expanded, 1) / torch.clamp(mask_expanded.sum(1), min=1e-9)
                
                return embedding
                
        except Exception as e:
            logger.error(f"Error extracting embedding: {e}")
            return None
    
    def embed_query(self, query: str) -> Optional[List[float]]:
        """
        Generate embedding for a query.
        Prefixes with instruction for asymmetric retrieval.
        """
        if not self._loaded:
            if not self.load():
                return None
        
        # Add query instruction prefix
        prefixed_query = f"Instruct: Retrieve relevant passages that answer the query\nQuery: {query}"
        
        embedding = self._get_text_embedding(prefixed_query)
        if embedding is not None:
            # Normalize
            embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)
            return embedding[0].cpu().numpy().tolist()
        return None
    
    def embed_passage(self, passage: str) -> Optional[List[float]]:
        """
        Generate embedding for a document passage.
        """
        if not self._loaded:
            if not self.load():
                return None
        
        embedding = self._get_text_embedding(passage)
        if embedding is not None:
            # Normalize
            embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)
            return embedding[0].cpu().numpy().tolist()
        return None
    
    def _embed_single(self, text: str) -> Optional[List[float]]:
        """Generate embedding for a single text."""
        embedding = self._get_text_embedding(text)
        if embedding is not None:
            embedding = torch.nn.functional.normalize(embedding, p=2, dim=1)
            return embedding[0].cpu().numpy().tolist()
        return None
    
    def embed_batch(
        self, 
        texts: List[str], 
        is_query: bool = False,
        show_progress: bool = False
    ) -> List[Optional[List[float]]]:
        """
        Generate embeddings for a batch of texts.
        
        Args:
            texts: List of texts to embed
            is_query: If True, add query prefix; if False, treat as passages
            show_progress: Show progress bar
        """
        if not self._loaded:
            if not self.load():
                return [None] * len(texts)
        
        results = []
        
        # Add prefixes
        if is_query:
            prefixed_texts = [
                f"Instruct: Retrieve relevant passages that answer the query\nQuery: {t}"
                for t in texts
            ]
        else:
            prefixed_texts = texts
        
        # Process in batches
        iterator = range(0, len(prefixed_texts), BATCH_SIZE)
        if show_progress:
            from tqdm import tqdm
            iterator = tqdm(iterator, desc="Generating embeddings")
        
        for i in iterator:
            batch = prefixed_texts[i:i + BATCH_SIZE]
            batch_embeddings = self._embed_batch_internal(batch)
            results.extend(batch_embeddings)
        
        return results
    
    def _embed_batch_internal(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Internal batch embedding without prefixing."""
        try:
            inputs = self.tokenizer(
                texts,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=MAX_SEQUENCE_LENGTH
            ).to(DEVICE)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                
                # Get last hidden state
                if hasattr(outputs, 'last_hidden_state'):
                    hidden_state = outputs.last_hidden_state
                else:
                    hidden_state = outputs[0]
                
                # Mean pooling
                attention_mask = inputs.get('attention_mask', torch.ones(hidden_state.shape[:2], device=DEVICE))
                mask_expanded = attention_mask.unsqueeze(-1).expand(hidden_state.size()).float()
                embeddings = torch.sum(hidden_state * mask_expanded, 1) / torch.clamp(mask_expanded.sum(1), min=1e-9)
                
                # Normalize
                embeddings = torch.nn.functional.normalize(embeddings, p=2, dim=1)
                
                return [emb.cpu().numpy().tolist() for emb in embeddings]
                
        except Exception as e:
            logger.error(f"Error in batch embedding: {e}")
            import traceback
            traceback.print_exc()
            return [None] * len(texts)
    
    @property
    def dimensions(self) -> int:
        """Return embedding dimensions."""
        return EMBEDDING_DIMENSIONS
    
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._loaded
    
    def unload(self):
        """Unload model to free memory."""
        if self.model is not None:
            del self.model
            self.model = None
        if self.tokenizer is not None:
            del self.tokenizer
            self.tokenizer = None
        self._loaded = False
        
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        
        logger.info("Embedding model unloaded")


class RerankerModel:
    """
    Qwen3-Reranker model for two-stage retrieval.
    Re-scores query-passage pairs for improved relevance ranking.
    CPU-optimized with AutoModel and AutoTokenizer.
    """
    
    def __init__(self, model_name: str = RERANKER_MODEL_NAME):
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self._loaded = False
    
    def load(self) -> bool:
        """Load the reranker model and tokenizer."""
        if self._loaded:
            return True
            
        try:
            logger.info(f"Loading reranker model: {self.model_name}")
            logger.info(f"This may take a few minutes on CPU...")
            
            self.tokenizer = AutoTokenizer.from_pretrained(
                self.model_name,
                trust_remote_code=True
            )
            
            self.model = AutoModel.from_pretrained(
                self.model_name,
                trust_remote_code=True,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True
            )
            
            self.model.to(DEVICE)
            self.model.eval()
            
            self._loaded = True
            logger.info(f"Reranker model loaded successfully on {DEVICE}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to load reranker model: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def _get_embedding(self, text: str) -> Optional[torch.Tensor]:
        """Extract embedding from text."""
        try:
            inputs = self.tokenizer(
                text,
                return_tensors="pt",
                padding=True,
                truncation=True,
                max_length=MAX_SEQUENCE_LENGTH
            ).to(DEVICE)
            
            with torch.no_grad():
                outputs = self.model(**inputs)
                
                if hasattr(outputs, 'last_hidden_state'):
                    hidden_state = outputs.last_hidden_state
                else:
                    hidden_state = outputs[0]
                
                # Mean pooling
                attention_mask = inputs.get('attention_mask', torch.ones(hidden_state.shape[:2], device=DEVICE))
                mask_expanded = attention_mask.unsqueeze(-1).expand(hidden_state.size()).float()
                embedding = torch.sum(hidden_state * mask_expanded, 1) / torch.clamp(mask_expanded.sum(1), min=1e-9)
                
                return torch.nn.functional.normalize(embedding, p=2, dim=1)
                
        except Exception as e:
            logger.error(f"Error getting embedding for reranking: {e}")
            return None
    
    def rerank(
        self, 
        query: str, 
        passages: List[dict],
        top_k: int = 10
    ) -> List[dict]:
        """
        Rerank passages based on relevance to query.
        Args:
            query: The search query
            passages: List of passage dicts with 'text' and 'score' fields
            top_k: Number of top results to return
            
        Returns:
            Reranked list of passages with updated scores
        """
        if not self._loaded:
            if not self.load():
                return passages[:top_k]
        
        if not passages:
            return []
        
        try:
            # Compute query-passage similarity scores
            rerank_scores = []
            
            # Get query embedding
            query_text = f"Instruct: Retrieve relevant passages that answer the query\nQuery: {query}"
            query_emb = self._get_embedding(query_text)
            
            if query_emb is None:
                return passages[:top_k]
            
            # Score each passage
            for passage in passages:
                text = passage.get("text", "")
                passage_emb = self._get_embedding(text)
                
                if passage_emb is not None:
                    # Cosine similarity
                    score = torch.sum(query_emb * passage_emb, dim=1).item()
                    rerank_scores.append(score)
                else:
                    rerank_scores.append(0.0)
            
            # Update passage scores and sort
            for i, passage in enumerate(passages):
                # Combine original score with rerank score
                original_score = passage.get("score", 0.5)
                passage["rerank_score"] = rerank_scores[i]
                # Weighted combination (rerank score weighted higher)
                passage["score"] = 0.3 * original_score + 0.7 * rerank_scores[i]
            
            # Sort by combined score (descending)
            reranked = sorted(passages, key=lambda x: x["score"], reverse=True)
            
            return reranked[:top_k]
            
        except Exception as e:
            logger.error(f"Error in reranking: {e}")
            return passages[:top_k]
    
    def is_loaded(self) -> bool:
        """Check if model is loaded."""
        return self._loaded
    
    def unload(self):
        """Unload model to free memory."""
        if self.model is not None:
            del self.model
            self.model = None
        if self.tokenizer is not None:
            del self.tokenizer
            self.tokenizer = None
        self._loaded = False
        
        if DEVICE == "cuda":
            torch.cuda.empty_cache()
        
        logger.info("Reranker model unloaded")


# ===== Global Model Instances =====

embedding_model = EmbeddingModel()
reranker_model = RerankerModel()


def warmup_models():
    """Pre-load models at startup."""
    logger.info("Warming up embedding models...")
    
    # Load embedding model
    if embedding_model.load():
        # Run a test embedding
        test_emb = embedding_model.embed_query("test query")
        if test_emb:
            logger.info(f"Embedding model ready. Dimension: {len(test_emb)}")
    
    # Load reranker model
    if reranker_model.load():
        logger.info("Reranker model ready.")
    
    logger.info("Model warmup complete.")


def get_embedding_dimensions() -> int:
    """Get the embedding dimensions."""
    return EMBEDDING_DIMENSIONS


# ===== Utility Functions =====

def compute_similarity(embedding1: List[float], embedding2: List[float]) -> float:
    """Compute cosine similarity between two embeddings."""
    arr1 = np.array(embedding1)
    arr2 = np.array(embedding2)
    
    return float(np.dot(arr1, arr2) / (np.linalg.norm(arr1) * np.linalg.norm(arr2)))


def compute_distance(embedding1: List[float], embedding2: List[float]) -> float:
    """Compute cosine distance (1 - similarity) between two embeddings."""
    return 1.0 - compute_similarity(embedding1, embedding2)
