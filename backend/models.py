"""
Intellecta RAG Backend - Pydantic Models
Data models for API request/response schemas matching frontend contract.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field


# ===== Enums =====

class SecurityLevel(str, Enum):
    """Security clearance levels (0-4 mapping)"""
    PUBLIC = "PUBLIC"           # Level 0
    INTERNAL = "INTERNAL"       # Level 1
    CONFIDENTIAL = "CONFIDENTIAL"  # Level 2
    RESTRICTED = "RESTRICTED"   # Level 3
    TOP_SECRET = "TOP_SECRET"   # Level 4


class Language(str, Enum):
    """Supported languages"""
    ENGLISH = "en"
    KOREAN = "ko"
    VIETNAMESE = "vi"


class DocumentStatus(str, Enum):
    """Document processing status"""
    READY = "ready"
    PROCESSING = "processing"
    ERROR = "error"


class SystemStatusType(str, Enum):
    """System component status"""
    IDLE = "idle"
    PROCESSING = "processing"
    SEARCHING = "searching"
    GENERATING = "generating"
    COMPLETE = "complete"
    ERROR = "error"


# ===== Query Models =====

class QueryRequest(BaseModel):
    """Request body for RAG query"""
    query: str = Field(..., description="The user's question")
    language: Language = Field(default=Language.ENGLISH, description="Response language")
    security_clearance: SecurityLevel = Field(
        default=SecurityLevel.PUBLIC, 
        description="User's security clearance level"
    )
    document_ids: Optional[List[str]] = Field(
        default=None, 
        description="Filter to specific documents (None = all)"
    )
    fast_mode: Optional[bool] = Field(
        default=True, 
        description="True = fast mode, False = quality mode"
    )


class SecurityInfo(BaseModel):
    """Security check results"""
    level: SecurityLevel
    level_value: int = Field(ge=0, le=4)
    warning: Optional[str] = None
    matched_keyword: Optional[str] = None
    access_allowed: bool


class KeywordInfo(BaseModel):
    """Extracted keywords from query"""
    keywords: List[str]
    entities: List[str] = []


class RetrievalMetrics(BaseModel):
    """Metrics for retrieval quality"""
    accuracy: float = Field(ge=0, le=100, description="Retrieval accuracy %")
    precision: float = Field(ge=0, le=100, description="Retrieval precision %")
    efficiency: float = Field(ge=0, le=100, description="Retrieval efficiency %")
    throughput: float = Field(ge=0, le=100, description="Processing throughput %")
    avg_distance: float = Field(description="Average cosine distance")
    min_distance: float = Field(description="Minimum cosine distance")
    max_distance: float = Field(description="Maximum cosine distance")
    high_quality_ratio: float = Field(ge=0, le=1, description="Ratio of high-quality chunks")
    chunks_analyzed: int = Field(ge=0, description="Number of chunks analyzed")
    chunks_per_second: float = Field(ge=0, description="Processing speed")


class QueryResponse(BaseModel):
    """Response for RAG query"""
    answer: str
    sources: List[str]
    retrieval_time_ms: float
    generation_time_ms: float
    fast_mode: bool = True
    model_used: str = "llama3.2:8b"
    security: Optional[SecurityInfo] = None
    keywords: Optional[KeywordInfo] = None
    chunks_used: int = 0
    chunks_blocked: int = 0
    metrics: Optional[RetrievalMetrics] = None


# ===== Document Models =====

class DocumentRecord(BaseModel):
    """Document metadata record"""
    id: str
    filename: str
    size: int = Field(ge=0, description="File size in bytes")
    chunks: int = Field(ge=0, description="Number of chunks created")
    ingested_at: datetime = Field(alias="ingestedAt")
    status: DocumentStatus
    security_level: SecurityLevel = SecurityLevel.PUBLIC
    source: Optional[str] = None  # Dataset source (opsd, nrel, etc.)

    class Config:
        populate_by_name = True


class IngestResponse(BaseModel):
    """Response for single file ingestion"""
    success: bool
    filename: str
    chunks_created: int
    message: str
    doc_id: Optional[str] = None


class BatchIngestFileResult(BaseModel):
    """Result for a single file in batch ingestion"""
    filename: str
    status: str = "success"  # 'success' or 'error' - for frontend compatibility
    success: bool
    chunks_created: int = 0
    message: str
    error: Optional[str] = None
    doc_id: Optional[str] = None


class BatchIngestResponse(BaseModel):
    """Response for batch file ingestion"""
    total: int
    successful: int
    failed: int
    results: List[BatchIngestFileResult]


# ===== Security Auto-Detection =====

class SecurityFinding(BaseModel):
    """Individual security finding"""
    type: str
    match: Optional[str] = None
    pattern: Optional[str] = None
    matches: Optional[List[str]] = None
    level: SecurityLevel


class SecurityAutoDetectResponse(BaseModel):
    """Response for security auto-detection"""
    detected_level: SecurityLevel
    level_value: int = Field(ge=0, le=4)
    confidence: float = Field(ge=0, le=1)
    findings_count: int
    findings: List[SecurityFinding]
    recommendation: str


# ===== System Status Models =====

class IngestionStatus(BaseModel):
    """Ingestion subsystem status"""
    status: SystemStatusType
    current_file: Optional[str] = None
    documents_processed: int = 0
    progress: Optional[float] = None  # 0-100%


class RetrievalStatus(BaseModel):
    """Retrieval subsystem status"""
    status: SystemStatusType
    last_query_time_ms: Optional[float] = None


class GenerationStatus(BaseModel):
    """Generation subsystem status"""
    status: SystemStatusType
    last_generation_time_ms: Optional[float] = None


class SystemStatus(BaseModel):
    """Overall system status"""
    ingestion: IngestionStatus
    retrieval: RetrievalStatus
    generation: GenerationStatus
    qdrant_connected: bool = False
    ollama_connected: bool = False
    models_loaded: bool = False


class SystemConfig(BaseModel):
    """System configuration"""
    embedding_model: str = "Qwen/Qwen3-VL-Embedding-2B"
    reranker_model: str = "Qwen/Qwen3-Reranker-0.6B"
    language_models: List[str] = ["LLaMA 3.2 8B"]
    vector_database: str = "Qdrant"
    chunk_size: int = 512
    chunk_overlap: int = 50
    storage_path: str = "qdrant://localhost:6333"
    embedding_dimensions: int = 2048


# ===== Statistics Models =====

class ChunksBySource(BaseModel):
    """Chunks grouped by source"""
    source: str
    chunks: int


class ChunksByDomain(BaseModel):
    """Chunks grouped by domain"""
    domain: str
    chunks: int


class ChunksByType(BaseModel):
    """Chunks grouped by file type"""
    type: str
    chunks: int


class ChunksByDocument(BaseModel):
    """Chunks grouped by document"""
    document_id: str
    filename: str
    chunks: int


class DocumentStats(BaseModel):
    """Individual document statistics"""
    id: str
    filename: str
    chunks: int
    size: int
    security_level: SecurityLevel


class DateRange(BaseModel):
    """Date range for data"""
    earliest: Optional[str] = None
    latest: Optional[str] = None


class DataStats(BaseModel):
    """Data statistics response"""
    total_chunks: int
    total_documents: int
    total_datasets: int
    chunks_by_source: List[ChunksBySource]
    chunks_by_domain: List[ChunksByDomain]
    chunks_by_type: List[ChunksByType]
    chunks_by_document: List[ChunksByDocument]
    date_range: DateRange
    documents: List[DocumentStats]


# ===== Query History Models =====

class QueryHistoryEntry(BaseModel):
    """Single query history entry"""
    id: str
    query: str
    language: str
    answer: str
    sources: List[str]
    retrieval_time_ms: float
    generation_time_ms: float
    timestamp: datetime
    fast_mode: bool = True
    security_level: SecurityLevel = SecurityLevel.PUBLIC


class QueryHistoryResponse(BaseModel):
    """Query history response"""
    history: List[QueryHistoryEntry]
    total: int


# ===== Metrics Models =====

class MetricsHistoryEntry(BaseModel):
    """Historical metrics entry"""
    timestamp: datetime
    accuracy: float
    precision: float
    efficiency: float
    throughput: float
    query_count: int


class PerformanceBreakdown(BaseModel):
    """Performance breakdown by operation"""
    operation: str
    avg_time_ms: float
    min_time_ms: float
    max_time_ms: float
    count: int


class QueryMetricsStats(BaseModel):
    """Aggregated query metrics"""
    total_queries: int
    avg_accuracy: float
    avg_precision: float
    avg_efficiency: float
    avg_throughput: float
    metrics_history: List[MetricsHistoryEntry]
    performance_breakdown: List[PerformanceBreakdown]


# ===== Dataset Models =====

class DatasetFile(BaseModel):
    """Dataset file metadata"""
    filename: str
    path: str
    size: int
    downloaded_at: datetime
    checksum: Optional[str] = None
    ingested: bool = False
    chunks_created: int = 0


class DatasetInfo(BaseModel):
    """Dataset information"""
    name: str
    description: str
    source_url: str
    files: List[DatasetFile]
    last_downloaded: Optional[datetime] = None
    version: Optional[str] = None
    auto_update: bool = False
    update_frequency_days: int = 30


class DatasetLoadProgress(BaseModel):
    """Dataset loading progress"""
    dataset: str
    status: str  # downloading, ingesting, complete, error
    progress: float  # 0-100
    current_file: Optional[str] = None
    files_processed: int = 0
    total_files: int = 0
    message: Optional[str] = None


class DatasetLoadResponse(BaseModel):
    """Response for dataset load operation"""
    success: bool
    datasets_loaded: int
    total_files: int
    total_chunks: int
    progress: List[DatasetLoadProgress]
    message: str


class DatasetsRegistry(BaseModel):
    """Full datasets registry"""
    datasets: Dict[str, DatasetInfo]
    ingestion_status: Dict[str, Any]
    last_updated: Optional[datetime] = None


# ===== Chunk Models (Internal) =====

class ChunkMetadata(BaseModel):
    """Metadata for a document chunk"""
    doc_id: str
    filename: str
    source: Optional[str] = None
    chunk_index: int
    total_chunks: int
    security_level: SecurityLevel
    created_at: datetime
    domain: Optional[str] = None  # energy, grid, solar, etc.
    file_type: str


class DocumentChunk(BaseModel):
    """Document chunk with embedding"""
    id: str
    text: str
    metadata: ChunkMetadata
    embedding: Optional[List[float]] = None
    score: Optional[float] = None  # Similarity score from retrieval
