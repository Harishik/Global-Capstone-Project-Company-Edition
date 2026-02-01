"""
Intellecta RAG Backend - Retriever Module
Qdrant vector store integration with two-stage retrieval (search + rerank).
"""

import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from qdrant_client.http.exceptions import UnexpectedResponse

from embedding import embedding_model, reranker_model, get_embedding_dimensions
from models import (
    SecurityLevel, RetrievalMetrics, DocumentChunk, ChunkMetadata
)
from security import security_checker, SECURITY_LEVEL_VALUES

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ===== Configuration =====

QDRANT_HOST = "localhost"
QDRANT_PORT = 6333
COLLECTION_NAME = "intellecta_documents"

# Retrieval settings
DEFAULT_TOP_K = 10
RERANK_CANDIDATES = 30  # Retrieve more, then rerank to top_k
MAX_DISTANCE = 0.35  # Maximum cosine distance for relevance

# Quality thresholds for metrics
QUALITY_THRESHOLDS = {
    "excellent": 0.15,
    "good": 0.25,
    "acceptable": 0.35,
}


class QdrantRetriever:
    """
    Qdrant-based vector retriever with two-stage retrieval.
    Stage 1: Dense retrieval from Qdrant
    Stage 2: Reranking with Qwen3-VL-Reranker
    """
    
    def __init__(
        self,
        host: str = QDRANT_HOST,
        port: int = QDRANT_PORT,
        collection_name: str = COLLECTION_NAME
    ):
        self.host = host
        self.port = port
        self.collection_name = collection_name
        self.client: Optional[QdrantClient] = None
        self._connected = False
    
    def connect(self) -> bool:
        """Connect to Qdrant server."""
        try:
            self.client = QdrantClient(host=self.host, port=self.port)
            
            # Test connection
            self.client.get_collections()
            
            self._connected = True
            logger.info(f"Connected to Qdrant at {self.host}:{self.port}")
            
            # Ensure collection exists
            self._ensure_collection()
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to connect to Qdrant: {e}")
            self._connected = False
            return False
    
    def _ensure_collection(self):
        """Create collection if it doesn't exist."""
        try:
            collections = self.client.get_collections().collections
            collection_names = [c.name for c in collections]
            
            if self.collection_name not in collection_names:
                logger.info(f"Creating collection: {self.collection_name}")
                
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=qdrant_models.VectorParams(
                        size=get_embedding_dimensions(),
                        distance=qdrant_models.Distance.COSINE
                    ),
                    # Enable HNSW indexing for fast search
                    hnsw_config=qdrant_models.HnswConfigDiff(
                        m=16,
                        ef_construct=100,
                        full_scan_threshold=10000
                    ),
                    # Optimize for many small updates
                    optimizers_config=qdrant_models.OptimizersConfigDiff(
                        indexing_threshold=20000
                    )
                )
                
                # Create payload indexes for filtering
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="doc_id",
                    field_schema=qdrant_models.PayloadSchemaType.KEYWORD
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="security_level",
                    field_schema=qdrant_models.PayloadSchemaType.KEYWORD
                )
                self.client.create_payload_index(
                    collection_name=self.collection_name,
                    field_name="source",
                    field_schema=qdrant_models.PayloadSchemaType.KEYWORD
                )
                
                logger.info(f"Collection {self.collection_name} created with indexes")
            else:
                logger.info(f"Collection {self.collection_name} already exists")
                
        except Exception as e:
            logger.error(f"Error ensuring collection: {e}")
    
    def is_connected(self) -> bool:
        """Check if connected to Qdrant."""
        if not self._connected or self.client is None:
            return False
        
        try:
            self.client.get_collections()
            return True
        except:
            self._connected = False
            return False
    
    def add_chunks(
        self,
        chunks: List[DocumentChunk],
        show_progress: bool = False
    ) -> Tuple[int, int]:
        """
        Add document chunks to the vector store.
        
        Returns:
            Tuple of (successful_count, failed_count)
        """
        if not self.is_connected():
            if not self.connect():
                return 0, len(chunks)
        
        # Generate embeddings for chunks
        texts = [chunk.text for chunk in chunks]
        embeddings = embedding_model.embed_batch(texts, is_query=False, show_progress=show_progress)
        
        successful = 0
        failed = 0
        
        points = []
        for chunk, embedding in zip(chunks, embeddings):
            if embedding is None:
                failed += 1
                continue
            
            # Create point for Qdrant
            point = qdrant_models.PointStruct(
                id=chunk.id,
                vector=embedding,
                payload={
                    "text": chunk.text,
                    "doc_id": chunk.metadata.doc_id,
                    "filename": chunk.metadata.filename,
                    "source": chunk.metadata.source,
                    "chunk_index": chunk.metadata.chunk_index,
                    "total_chunks": chunk.metadata.total_chunks,
                    "security_level": chunk.metadata.security_level.value,
                    "created_at": chunk.metadata.created_at.isoformat(),
                    "domain": chunk.metadata.domain,
                    "file_type": chunk.metadata.file_type
                }
            )
            points.append(point)
            successful += 1
        
        # Batch upsert to Qdrant
        if points:
            try:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=points,
                    wait=True
                )
                logger.info(f"Added {successful} chunks to Qdrant")
            except Exception as e:
                logger.error(f"Error upserting to Qdrant: {e}")
                return 0, len(chunks)
        
        return successful, failed
    
    def search(
        self,
        query: str,
        top_k: int = DEFAULT_TOP_K,
        document_ids: Optional[List[str]] = None,
        security_clearance: SecurityLevel = SecurityLevel.PUBLIC,
        use_reranker: bool = True,
        max_distance: float = MAX_DISTANCE
    ) -> Tuple[List[Dict], RetrievalMetrics]:
        """
        Two-stage retrieval: dense search + reranking.
        
        Args:
            query: Search query
            top_k: Number of results to return
            document_ids: Filter to specific documents
            security_clearance: User's security clearance
            use_reranker: Whether to apply reranking stage
            max_distance: Maximum cosine distance threshold
            
        Returns:
            Tuple of (results, metrics)
        """
        start_time = time.time()
        
        if not self.is_connected():
            if not self.connect():
                return [], self._empty_metrics()
        
        # Generate query embedding
        query_embedding = embedding_model.embed_query(query)
        if query_embedding is None:
            logger.error("Failed to generate query embedding")
            return [], self._empty_metrics()
        
        embed_time = time.time()
        
        # Build filters
        filters = self._build_filters(document_ids, security_clearance)
        
        # Stage 1: Dense retrieval
        candidates_count = RERANK_CANDIDATES if use_reranker else top_k
        
        try:
            # Use query_points for newer qdrant-client versions
            # Don't use score_threshold to avoid filtering out valid results
            # when searching in small document sets
            search_results = self.client.query_points(
                collection_name=self.collection_name,
                query=query_embedding,
                limit=candidates_count,
                query_filter=filters,
                with_payload=True
            ).points
            
            logger.info(f"Qdrant returned {len(search_results)} results for query: '{query[:50]}...'")
            if search_results:
                logger.info(f"Top result score: {search_results[0].score:.4f}")
                
        except Exception as e:
            logger.error(f"Qdrant search error: {e}")
            return [], self._empty_metrics()
        
        search_time = time.time()
        
        # Convert results to dict format
        results = []
        for hit in search_results:
            # Score in Qdrant is similarity (higher is better)
            # Convert to distance for consistency
            distance = 1 - hit.score
            
            result = {
                "id": hit.id,
                "text": hit.payload.get("text", ""),
                "score": hit.score,
                "distance": distance,
                "doc_id": hit.payload.get("doc_id"),
                "filename": hit.payload.get("filename"),
                "source": hit.payload.get("source"),
                "chunk_index": hit.payload.get("chunk_index"),
                "security_level": hit.payload.get("security_level"),
                "domain": hit.payload.get("domain"),
                "file_type": hit.payload.get("file_type")
            }
            results.append(result)
        
        # Apply distance threshold for filtering
        # Use more lenient threshold when filtering by specific documents
        effective_max_distance = max_distance if not document_ids else 0.7
        filtered_results = [r for r in results if r["distance"] <= effective_max_distance]
        
        logger.info(f"Filtered {len(results)} -> {len(filtered_results)} results (max_distance={effective_max_distance})")
        
        results = filtered_results
        
        # Stage 2: Reranking
        if use_reranker and results:
            results = reranker_model.rerank(query, results, top_k=top_k)
        else:
            results = results[:top_k]
        
        rerank_time = time.time()
        
        # Calculate metrics
        metrics = self._calculate_metrics(
            results=results,
            embed_time=embed_time - start_time,
            search_time=search_time - embed_time,
            rerank_time=rerank_time - search_time if use_reranker else 0,
            total_time=rerank_time - start_time,
            candidates_count=len(search_results)
        )
        
        return results, metrics
    
    def _build_filters(
        self,
        document_ids: Optional[List[str]],
        security_clearance: SecurityLevel
    ) -> Optional[qdrant_models.Filter]:
        """Build Qdrant filter conditions."""
        conditions = []
        
        # Document ID filter
        if document_ids:
            conditions.append(
                qdrant_models.FieldCondition(
                    key="doc_id",
                    match=qdrant_models.MatchAny(any=document_ids)
                )
            )
        
        # Security level filter - only show chunks user can access
        user_level_value = SECURITY_LEVEL_VALUES[security_clearance]
        allowed_levels = [
            level.value for level, value in SECURITY_LEVEL_VALUES.items()
            if value <= user_level_value
        ]
        
        conditions.append(
            qdrant_models.FieldCondition(
                key="security_level",
                match=qdrant_models.MatchAny(any=allowed_levels)
            )
        )
        
        if conditions:
            return qdrant_models.Filter(must=conditions)
        return None
    
    def _calculate_metrics(
        self,
        results: List[Dict],
        embed_time: float,
        search_time: float,
        rerank_time: float,
        total_time: float,
        candidates_count: int
    ) -> RetrievalMetrics:
        """Calculate retrieval quality metrics."""
        if not results:
            return self._empty_metrics()
        
        distances = [r.get("distance", 0.5) for r in results]
        avg_distance = sum(distances) / len(distances)
        min_distance = min(distances)
        max_distance = max(distances)
        
        # Count quality tiers
        excellent = sum(1 for d in distances if d < QUALITY_THRESHOLDS["excellent"])
        good = sum(1 for d in distances if QUALITY_THRESHOLDS["excellent"] <= d < QUALITY_THRESHOLDS["good"])
        acceptable = sum(1 for d in distances if QUALITY_THRESHOLDS["good"] <= d < QUALITY_THRESHOLDS["acceptable"])
        
        high_quality_ratio = (excellent + good) / len(distances) if distances else 0
        
        # Calculate scores (0-100)
        accuracy = max(0, 100 - (avg_distance * 40))  # Lower distance = higher accuracy
        
        # Precision based on quality tier distribution
        weighted_quality = (excellent * 1.0 + good * 0.7 + acceptable * 0.4) / len(distances)
        precision = 85 + weighted_quality * 15
        
        # Efficiency based on retrieval time (target: < 3 seconds)
        efficiency = max(0, 100 - (total_time / 3.0 * 10))
        
        # Throughput based on chunks per second
        chunks_per_second = candidates_count / total_time if total_time > 0 else 0
        throughput = min(100, 90 + chunks_per_second * 2)
        
        return RetrievalMetrics(
            accuracy=round(accuracy, 1),
            precision=round(precision, 1),
            efficiency=round(efficiency, 1),
            throughput=round(throughput, 1),
            avg_distance=round(avg_distance, 4),
            min_distance=round(min_distance, 4),
            max_distance=round(max_distance, 4),
            high_quality_ratio=round(high_quality_ratio, 2),
            chunks_analyzed=candidates_count,
            chunks_per_second=round(chunks_per_second, 1)
        )
    
    def _empty_metrics(self) -> RetrievalMetrics:
        """Return empty metrics when no results."""
        return RetrievalMetrics(
            accuracy=0,
            precision=0,
            efficiency=0,
            throughput=0,
            avg_distance=1.0,
            min_distance=1.0,
            max_distance=1.0,
            high_quality_ratio=0,
            chunks_analyzed=0,
            chunks_per_second=0
        )
    
    def delete_by_doc_id(self, doc_id: str) -> bool:
        """Delete all chunks for a document."""
        if not self.is_connected():
            return False
        
        try:
            self.client.delete(
                collection_name=self.collection_name,
                points_selector=qdrant_models.FilterSelector(
                    filter=qdrant_models.Filter(
                        must=[
                            qdrant_models.FieldCondition(
                                key="doc_id",
                                match=qdrant_models.MatchValue(value=doc_id)
                            )
                        ]
                    )
                )
            )
            logger.info(f"Deleted chunks for document: {doc_id}")
            return True
        except Exception as e:
            logger.error(f"Error deleting document chunks: {e}")
            return False
    
    def get_collection_stats(self) -> Dict[str, Any]:
        """Get collection statistics."""
        if not self.is_connected():
            return {"error": "Not connected"}
        
        try:
            info = self.client.get_collection(self.collection_name)
            return {
                "vectors_count": info.vectors_count,
                "points_count": info.points_count,
                "indexed_vectors_count": info.indexed_vectors_count,
                "status": info.status.value
            }
        except Exception as e:
            logger.error(f"Error getting collection stats: {e}")
            return {"error": str(e)}
    
    def count_by_field(self, field: str) -> Dict[str, int]:
        """Count chunks grouped by a field (e.g., source, doc_id)."""
        if not self.is_connected():
            return {}
        
        try:
            # Scroll through all points and aggregate
            counts = {}
            offset = None
            
            while True:
                results, offset = self.client.scroll(
                    collection_name=self.collection_name,
                    limit=1000,
                    offset=offset,
                    with_payload=[field]
                )
                
                for point in results:
                    value = point.payload.get(field, "unknown")
                    counts[value] = counts.get(value, 0) + 1
                
                if offset is None:
                    break
            
            return counts
            
        except Exception as e:
            logger.error(f"Error counting by field: {e}")
            return {}
    
    # ===== Async Wrappers for Pretraining =====
    
    async def initialize(self) -> bool:
        """Async wrapper for connect()."""
        return self.connect()
    
    async def add_document(
        self,
        text: str,
        metadata: Dict,
        security_level: SecurityLevel = SecurityLevel.PUBLIC
    ) -> Optional[str]:
        """
        Add a single document chunk to the vector store.
        Returns the chunk ID if successful, None otherwise.
        """
        if not self.is_connected():
            if not self.connect():
                return None
        
        try:
            # Generate embedding
            embedding = embedding_model.embed_passage(text)
            if embedding is None:
                logger.error("Failed to generate embedding")
                return None
            
            # Generate unique ID
            chunk_id = str(uuid.uuid4())
            
            # Create point for Qdrant
            point = qdrant_models.PointStruct(
                id=chunk_id,
                vector=embedding,
                payload={
                    "text": text,
                    "doc_id": metadata.get("document_id", ""),
                    "filename": metadata.get("filename", ""),
                    "source": metadata.get("dataset", ""),
                    "chunk_index": metadata.get("chunk_index", 0),
                    "security_level": security_level.value,
                    "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    **{k: v for k, v in metadata.items() if k not in ["document_id", "filename", "dataset", "chunk_index"]}
                }
            )
            
            # Upsert to Qdrant
            self.client.upsert(
                collection_name=self.collection_name,
                points=[point],
                wait=True
            )
            
            return chunk_id
            
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            return None
    
    async def get_collection_count(self) -> int:
        """Get total number of vectors in the collection."""
        if not self.is_connected():
            return 0
        
        try:
            info = self.client.get_collection(self.collection_name)
            return info.points_count
        except Exception as e:
            logger.error(f"Error getting collection count: {e}")
            return 0


# ===== Global Retriever Instance =====

retriever = QdrantRetriever()


def initialize_retriever() -> bool:
    """Initialize the retriever connection."""
    return retriever.connect()
