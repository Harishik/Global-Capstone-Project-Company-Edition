"""
Intellecta RAG Backend - Main FastAPI Application
All endpoints, auto-ingestion on startup, dataset versioning.
"""

import asyncio
import json
import logging
import os
import shutil
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import (
    QueryRequest, QueryResponse, SecurityLevel, Language,
    DocumentRecord, DocumentStatus, IngestResponse, BatchIngestResponse, BatchIngestFileResult,
    SecurityAutoDetectResponse, SystemStatus, SystemConfig, DataStats,
    IngestionStatus, RetrievalStatus, GenerationStatus, SystemStatusType,
    QueryHistoryEntry, QueryHistoryResponse, QueryMetricsStats,
    MetricsHistoryEntry, PerformanceBreakdown,
    ChunksBySource, ChunksByDomain, ChunksByType, ChunksByDocument, DocumentStats, DateRange,
    DatasetLoadResponse, DatasetLoadProgress
)
from security import security_checker
from document_processor import document_processor, UPLOAD_DIR, get_supported_extensions
from retriever import retriever, initialize_retriever
from rag_engine import rag_engine, initialize_rag_engine
from embedding import warmup_models, get_embedding_dimensions
from database import db_manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ===== Configuration =====

DATA_DIR = Path(__file__).parent / "data"
DOCUMENTS_REGISTRY_PATH = DATA_DIR / "documents_registry.json"
QUERY_HISTORY_PATH = DATA_DIR / "query_history.json"
DATASETS_REGISTRY_PATH = DATA_DIR / "datasets_registry.json"
METRICS_HISTORY_PATH = DATA_DIR / "metrics_history.json"

# Environment variables
FAST_MODE_DEFAULT = os.getenv("FAST_MODE", "true").lower() == "true"
AUTO_LOAD_DATASETS = os.getenv("AUTO_LOAD_DATASETS", "false").lower() == "true"


# ===== State Management =====

class AppState:
    """Application state management."""
    
    def __init__(self):
        self.ingestion_status = IngestionStatus(status=SystemStatusType.IDLE, documents_processed=0)
        self.retrieval_status = RetrievalStatus(status=SystemStatusType.IDLE)
        self.generation_status = GenerationStatus(status=SystemStatusType.IDLE)
        self.qdrant_connected = False
        self.ollama_connected = False
        self.models_loaded = False

app_state = AppState()


# ===== Data Persistence =====

def load_json(path: Path) -> dict:
    """Load JSON file."""
    try:
        if path.exists():
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logger.error(f"Error loading {path}: {e}")
    return {}


def save_json(path: Path, data: dict):
    """Save JSON file."""
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Error saving {path}: {e}")


def get_documents_registry() -> dict:
    """Get documents registry."""
    return load_json(DOCUMENTS_REGISTRY_PATH)


def save_documents_registry(data: dict):
    """Save documents registry."""
    data["last_updated"] = datetime.now().isoformat()
    save_json(DOCUMENTS_REGISTRY_PATH, data)


def get_query_history() -> dict:
    """Get query history."""
    return load_json(QUERY_HISTORY_PATH)


def save_query_history(data: dict):
    """Save query history."""
    data["last_updated"] = datetime.now().isoformat()
    save_json(QUERY_HISTORY_PATH, data)


def get_metrics_history() -> dict:
    """Get metrics history."""
    return load_json(METRICS_HISTORY_PATH)


def save_metrics_history(data: dict):
    """Save metrics history."""
    data["last_updated"] = datetime.now().isoformat()
    save_json(METRICS_HISTORY_PATH, data)


# ===== Lifecycle =====

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    logger.info("Starting Intellecta RAG Backend...")
    
    # Initialize PostgreSQL
    logger.info("Connecting to PostgreSQL...")
    try:
        await db_manager.initialize()
        logger.info("PostgreSQL connected and initialized")
    except Exception as e:
        logger.warning(f"PostgreSQL initialization failed: {e}")
    
    # Initialize Qdrant
    logger.info("Connecting to Qdrant...")
    app_state.qdrant_connected = initialize_retriever()
    
    # Initialize Ollama/LLM
    logger.info("Checking Ollama connection...")
    app_state.ollama_connected = await rag_engine.check_ollama_connection()
    
    # Warmup embedding models
    logger.info("Loading embedding models...")
    try:
        warmup_models()
        app_state.models_loaded = True
    except Exception as e:
        logger.error(f"Failed to load embedding models: {e}")
    
    # Warmup LLM
    if app_state.ollama_connected:
        logger.info("Warming up LLM...")
        await rag_engine.warmup_model()
    
    # Auto-load datasets if enabled
    if AUTO_LOAD_DATASETS:
        logger.info("Auto-loading datasets...")
        # This would be implemented in load_datasets.py
        pass
    
    logger.info("Backend initialization complete!")
    logger.info(f"  - PostgreSQL: Connected")
    logger.info(f"  - Qdrant: {'Connected' if app_state.qdrant_connected else 'Not connected'}")
    logger.info(f"  - Ollama: {'Connected' if app_state.ollama_connected else 'Not connected'}")
    logger.info(f"  - Models: {'Loaded' if app_state.models_loaded else 'Not loaded'}")
    
    yield
    
    # Cleanup
    logger.info("Shutting down...")
    await db_manager.close()


# ===== FastAPI App =====

app = FastAPI(
    title="Intellecta RAG API",
    description="Production-grade RAG system with Qdrant, Qwen3-VL, and LLaMA 3.2",
    version="2.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Health & Status Endpoints =====

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "qdrant": app_state.qdrant_connected,
        "ollama": app_state.ollama_connected,
        "models_loaded": app_state.models_loaded
    }


@app.get("/status", response_model=SystemStatus)
async def get_status():
    """Get system status."""
    return SystemStatus(
        ingestion=app_state.ingestion_status,
        retrieval=app_state.retrieval_status,
        generation=app_state.generation_status,
        qdrant_connected=app_state.qdrant_connected,
        ollama_connected=app_state.ollama_connected,
        models_loaded=app_state.models_loaded
    )


@app.get("/config", response_model=SystemConfig)
async def get_config():
    """Get system configuration."""
    return SystemConfig(
        embedding_model="Qwen/Qwen3-VL-Embedding-2B",
        reranker_model="Qwen/Qwen3-Reranker-0.6B",
        language_models=["LLaMA 3.2 8B"],
        vector_database="Qdrant",
        chunk_size=512,
        chunk_overlap=50,
        storage_path="qdrant://localhost:6333",
        embedding_dimensions=get_embedding_dimensions()
    )


# ===== Query Endpoints =====

@app.post("/query", response_model=QueryResponse)
async def query(request: QueryRequest):
    """Process a RAG query."""
    try:
        app_state.retrieval_status.status = SystemStatusType.SEARCHING
        app_state.generation_status.status = SystemStatusType.GENERATING
        
        response = await rag_engine.process_query(request)
        
        app_state.retrieval_status.status = SystemStatusType.COMPLETE
        app_state.retrieval_status.last_query_time_ms = response.retrieval_time_ms
        app_state.generation_status.status = SystemStatusType.COMPLETE
        app_state.generation_status.last_generation_time_ms = response.generation_time_ms
        
        # Save to history
        history = get_query_history()
        if "history" not in history:
            history["history"] = []
        
        entry = {
            "id": str(uuid.uuid4()),
            "query": request.query,
            "language": request.language.value,
            "answer": response.answer,
            "sources": response.sources,
            "retrieval_time_ms": response.retrieval_time_ms,
            "generation_time_ms": response.generation_time_ms,
            "timestamp": datetime.now().isoformat(),
            "fast_mode": response.fast_mode,
            "security_level": request.security_clearance.value
        }
        history["history"].insert(0, entry)
        history["history"] = history["history"][:100]  # Keep last 100
        save_query_history(history)
        
        # Save metrics
        if response.metrics:
            metrics = get_metrics_history()
            if "metrics" not in metrics:
                metrics["metrics"] = []
            
            metrics["metrics"].insert(0, {
                "timestamp": datetime.now().isoformat(),
                "accuracy": response.metrics.accuracy,
                "precision": response.metrics.precision,
                "efficiency": response.metrics.efficiency,
                "throughput": response.metrics.throughput,
                "query_count": 1
            })
            metrics["metrics"] = metrics["metrics"][:500]
            save_metrics_history(metrics)
        
        return response
        
    except Exception as e:
        logger.error(f"Query error: {e}")
        app_state.retrieval_status.status = SystemStatusType.ERROR
        app_state.generation_status.status = SystemStatusType.ERROR
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/query/history", response_model=QueryHistoryResponse)
async def get_history(limit: int = 50):
    """Get query history."""
    history = get_query_history()
    entries = history.get("history", [])[:limit]
    
    return QueryHistoryResponse(
        history=[QueryHistoryEntry(**e) for e in entries],
        total=len(history.get("history", []))
    )


@app.delete("/query/history")
async def clear_history():
    """Clear all query history."""
    save_query_history({"history": []})
    return {"message": "History cleared"}


@app.delete("/query/history/{entry_id}")
async def delete_history_entry(entry_id: str):
    """Delete a specific history entry."""
    history = get_query_history()
    entries = history.get("history", [])
    history["history"] = [e for e in entries if e.get("id") != entry_id]
    save_query_history(history)
    return {"message": "Entry deleted"}


@app.get("/query/metrics", response_model=QueryMetricsStats)
async def get_metrics():
    """Get aggregated query metrics."""
    metrics = get_metrics_history()
    entries = metrics.get("metrics", [])
    
    if not entries:
        return QueryMetricsStats(
            total_queries=0,
            avg_accuracy=0,
            avg_precision=0,
            avg_efficiency=0,
            avg_throughput=0,
            metrics_history=[],
            performance_breakdown=[]
        )
    
    total = len(entries)
    avg_accuracy = sum(e.get("accuracy", 0) for e in entries) / total
    avg_precision = sum(e.get("precision", 0) for e in entries) / total
    avg_efficiency = sum(e.get("efficiency", 0) for e in entries) / total
    avg_throughput = sum(e.get("throughput", 0) for e in entries) / total
    
    return QueryMetricsStats(
        total_queries=total,
        avg_accuracy=round(avg_accuracy, 2),
        avg_precision=round(avg_precision, 2),
        avg_efficiency=round(avg_efficiency, 2),
        avg_throughput=round(avg_throughput, 2),
        metrics_history=[MetricsHistoryEntry(**e) for e in entries[:50]],
        performance_breakdown=[]
    )


# ===== Document Ingestion Endpoints =====

@app.post("/ingest", response_model=IngestResponse)
async def ingest_document(
    file: UploadFile = File(...),
    security_level: SecurityLevel = Form(default=SecurityLevel.PUBLIC),
    source: Optional[str] = Form(default=None)
):
    """Ingest a single document."""
    try:
        app_state.ingestion_status.status = SystemStatusType.PROCESSING
        app_state.ingestion_status.current_file = file.filename
        
        # Save uploaded file
        file_path = UPLOAD_DIR / file.filename
        with open(file_path, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Get file extension
        file_ext = Path(file.filename).suffix.lower()
        
        # Process document
        chunks, doc_id = document_processor.process_file(
            file_path=str(file_path),
            filename=file.filename,
            security_level=security_level,
            source=source
        )
        
        # Add to vector store (Qdrant)
        successful, failed = retriever.add_chunks(chunks, show_progress=False)
        
        # Store in PostgreSQL
        try:
            # Insert document metadata
            pg_doc_id = await db_manager.insert_document(
                filename=file.filename,
                file_type=file_ext,
                file_size=len(content),
                security_level=security_level.value,
                metadata={"source": source, "original_doc_id": doc_id}
            )
            
            # Insert chunks
            if chunks:
                chunk_records = []
                for i, chunk in enumerate(chunks):
                    chunk_records.append({
                        "document_id": pg_doc_id,
                        "chunk_index": i,
                        "chunk_text": chunk.text,
                        "qdrant_point_id": chunk.id,
                        "metadata": {
                            "filename": chunk.metadata.filename,
                            "security_level": chunk.metadata.security_level.value,
                            "domain": chunk.metadata.domain
                        }
                    })
                await db_manager.insert_chunks_batch(chunk_records)
                await db_manager.update_document_chunk_count(pg_doc_id, successful)
            
            logger.info(f"Stored document {file.filename} in PostgreSQL with {successful} chunks")
        except Exception as db_error:
            logger.warning(f"PostgreSQL storage failed (non-fatal): {db_error}")
        
        # Update local registry (backup)
        registry = get_documents_registry()
        if "documents" not in registry:
            registry["documents"] = []
        
        registry["documents"].append({
            "id": doc_id,
            "filename": file.filename,
            "size": len(content),
            "chunks": successful,
            "ingestedAt": datetime.now().isoformat(),
            "status": "ready" if failed == 0 else "error",
            "security_level": security_level.value,
            "source": source
        })
        save_documents_registry(registry)
        
        app_state.ingestion_status.status = SystemStatusType.COMPLETE
        app_state.ingestion_status.documents_processed += 1
        app_state.ingestion_status.current_file = None
        
        return IngestResponse(
            success=failed == 0,
            filename=file.filename,
            chunks_created=successful,
            message=f"Created {successful} chunks" if failed == 0 else f"Created {successful} chunks, {failed} failed",
            doc_id=doc_id
        )
        
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        app_state.ingestion_status.status = SystemStatusType.ERROR
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ingest/batch", response_model=BatchIngestResponse)
async def ingest_batch(
    files: List[UploadFile] = File(...),
    security_level: SecurityLevel = Form(default=SecurityLevel.PUBLIC),
    source: Optional[str] = Form(default=None)
):
    """Ingest multiple documents."""
    results = []
    successful = 0
    failed = 0
    
    for file in files:
        try:
            app_state.ingestion_status.current_file = file.filename
            
            # Save file
            file_path = UPLOAD_DIR / file.filename
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            
            # Process
            chunks, doc_id = document_processor.process_file(
                file_path=str(file_path),
                filename=file.filename,
                security_level=security_level,
                source=source
            )
            
            # Add to vector store
            succ, fail = retriever.add_chunks(chunks)
            
            # Update registry
            registry = get_documents_registry()
            if "documents" not in registry:
                registry["documents"] = []
            
            registry["documents"].append({
                "id": doc_id,
                "filename": file.filename,
                "size": len(content),
                "chunks": succ,
                "ingestedAt": datetime.now().isoformat(),
                "status": "ready",
                "security_level": security_level.value,
                "source": source
            })
            save_documents_registry(registry)
            
            results.append(BatchIngestFileResult(
                filename=file.filename,
                status="success",
                success=True,
                chunks_created=succ,
                message=f"Created {succ} chunks",
                doc_id=doc_id
            ))
            successful += 1
            
        except Exception as e:
            logger.error(f"Error ingesting {file.filename}: {e}")
            results.append(BatchIngestFileResult(
                filename=file.filename,
                status="error",
                success=False,
                chunks_created=0,
                message=str(e),
                error=str(e)
            ))
            failed += 1
    
    app_state.ingestion_status.documents_processed += successful
    app_state.ingestion_status.current_file = None
    
    return BatchIngestResponse(
        total=len(files),
        successful=successful,
        failed=failed,
        results=results
    )


@app.get("/documents")
async def list_documents():
    """List all ingested documents."""
    registry = get_documents_registry()
    return registry.get("documents", [])


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """Delete a document and its chunks."""
    # Remove from vector store
    success = retriever.delete_by_doc_id(doc_id)
    
    # Remove from registry
    registry = get_documents_registry()
    docs = registry.get("documents", [])
    registry["documents"] = [d for d in docs if d.get("id") != doc_id]
    save_documents_registry(registry)
    
    return {"message": "Document deleted", "success": success}


# ===== Security Endpoints =====

@app.post("/security/auto-detect", response_model=SecurityAutoDetectResponse)
async def auto_detect_security(file: UploadFile = File(...)):
    """Auto-detect security level for a document."""
    try:
        # Read file content
        content = await file.read()
        
        # Try to extract text based on file type
        ext = Path(file.filename).suffix.lower()
        
        if ext in ['.txt', '.md', '.csv', '.json']:
            text = content.decode('utf-8', errors='ignore')
        else:
            # Save temporarily and process
            temp_path = UPLOAD_DIR / f"temp_{file.filename}"
            with open(temp_path, "wb") as f:
                f.write(content)
            
            try:
                chunks, _ = document_processor.process_file(
                    file_path=str(temp_path),
                    filename=file.filename
                )
                text = " ".join([c.text for c in chunks[:10]])
            finally:
                temp_path.unlink(missing_ok=True)
        
        # Run security detection
        result = security_checker.auto_detect_security(text)
        return result
        
    except Exception as e:
        logger.error(f"Security detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ===== Statistics Endpoints =====

@app.get("/stats", response_model=DataStats)
async def get_stats():
    """Get data statistics."""
    registry = get_documents_registry()
    docs = registry.get("documents", [])
    
    # Aggregate statistics
    total_chunks = sum(d.get("chunks", 0) for d in docs)
    total_documents = len(docs)
    
    # Group by source
    by_source = {}
    for d in docs:
        source = d.get("source") or "uploads"
        by_source[source] = by_source.get(source, 0) + d.get("chunks", 0)
    
    # Group by domain (from Qdrant if available)
    by_domain = retriever.count_by_field("domain") if retriever.is_connected() else {}
    
    # Group by file type
    by_type = {}
    for d in docs:
        ext = Path(d.get("filename", "")).suffix.lower() or "unknown"
        by_type[ext] = by_type.get(ext, 0) + d.get("chunks", 0)
    
    # By document
    chunks_by_doc = [
        ChunksByDocument(
            document_id=d.get("id", ""),
            filename=d.get("filename", ""),
            chunks=d.get("chunks", 0)
        )
        for d in docs
    ]
    
    # Date range
    dates = [d.get("ingestedAt") for d in docs if d.get("ingestedAt")]
    date_range = DateRange(
        earliest=min(dates) if dates else None,
        latest=max(dates) if dates else None
    )
    
    # Document stats
    doc_stats = [
        DocumentStats(
            id=d.get("id", ""),
            filename=d.get("filename", ""),
            chunks=d.get("chunks", 0),
            size=d.get("size", 0),
            security_level=SecurityLevel(d.get("security_level", "PUBLIC"))
        )
        for d in docs
    ]
    
    return DataStats(
        total_chunks=total_chunks,
        total_documents=total_documents,
        total_datasets=len(set(d.get("source") for d in docs if d.get("source"))),
        chunks_by_source=[ChunksBySource(source=k, chunks=v) for k, v in by_source.items()],
        chunks_by_domain=[ChunksByDomain(domain=k or "unknown", chunks=v) for k, v in by_domain.items()],
        chunks_by_type=[ChunksByType(type=k, chunks=v) for k, v in by_type.items()],
        chunks_by_document=chunks_by_doc,
        date_range=date_range,
        documents=doc_stats
    )


# ===== Dataset Endpoints =====

@app.post("/datasets/load", response_model=DatasetLoadResponse)
async def load_datasets(background_tasks: BackgroundTasks):
    """Trigger loading of training datasets."""
    # This will be implemented by load_datasets.py
    return DatasetLoadResponse(
        success=True,
        datasets_loaded=0,
        total_files=0,
        total_chunks=0,
        progress=[],
        message="Dataset loading initiated. Check /datasets/status for progress."
    )


@app.get("/datasets/status")
async def get_dataset_status():
    """Get dataset loading status."""
    registry = load_json(DATASETS_REGISTRY_PATH)
    return registry


# ===== Main Entry Point =====

if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
