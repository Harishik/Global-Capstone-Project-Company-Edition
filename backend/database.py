"""
Intellecta RAG Backend - Database Module
PostgreSQL integration for document metadata, query logs, and audit trails.
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import asyncpg
from asyncpg import Pool

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ===== Configuration =====

DATABASE_CONFIG = {
    "host": os.getenv("POSTGRES_HOST", "localhost"),
    "port": int(os.getenv("POSTGRES_PORT", "5433")),  # Using 5433 to avoid conflict with local PostgreSQL
    "database": os.getenv("POSTGRES_DB", "intellecta"),
    "user": os.getenv("POSTGRES_USER", "postgres"),
    "password": os.getenv("POSTGRES_PASSWORD", "postgres"),
    "min_size": 5,
    "max_size": 20,
}


# ===== Database Schema =====

SCHEMA_SQL = """
-- Documents table: stores document metadata
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename VARCHAR(500) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT,
    file_hash VARCHAR(64),
    security_level VARCHAR(50) DEFAULT 'public',
    language VARCHAR(10) DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    chunk_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- Document chunks table: stores chunk metadata (vectors in Qdrant)
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    chunk_text TEXT NOT NULL,
    char_start INTEGER,
    char_end INTEGER,
    token_count INTEGER,
    qdrant_point_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Query history table: stores all queries for analytics
CREATE TABLE IF NOT EXISTS query_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    language VARCHAR(10) DEFAULT 'en',
    fast_mode BOOLEAN DEFAULT TRUE,
    security_clearance VARCHAR(50) DEFAULT 'public',
    response_text TEXT,
    sources JSONB DEFAULT '[]',
    retrieval_time_ms FLOAT,
    generation_time_ms FLOAT,
    total_time_ms FLOAT,
    chunks_retrieved INTEGER,
    security_level VARCHAR(50),
    access_allowed BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(100),
    session_id VARCHAR(100),
    feedback_rating INTEGER,
    metadata JSONB DEFAULT '{}'
);

-- Dataset registry table: tracks ingested datasets
CREATE TABLE IF NOT EXISTS dataset_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_name VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    source_url TEXT,
    version VARCHAR(50) DEFAULT '1.0',
    file_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    last_downloaded TIMESTAMP WITH TIME ZONE,
    last_ingested TIMESTAMP WITH TIME ZONE,
    auto_update BOOLEAN DEFAULT FALSE,
    update_frequency_days INTEGER DEFAULT 30,
    status VARCHAR(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Ingestion jobs table: tracks ingestion progress
CREATE TABLE IF NOT EXISTS ingestion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID REFERENCES dataset_registry(id),
    document_id UUID REFERENCES documents(id),
    job_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    progress FLOAT DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    processed_items INTEGER DEFAULT 0,
    failed_items INTEGER DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Audit log table: security and access auditing
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    user_id VARCHAR(100),
    ip_address VARCHAR(50),
    security_level VARCHAR(50),
    access_allowed BOOLEAN DEFAULT TRUE,
    details JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);
CREATE INDEX IF NOT EXISTS idx_documents_security ON documents(security_level);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_qdrant ON document_chunks(qdrant_point_id);
CREATE INDEX IF NOT EXISTS idx_query_history_created ON query_history(created_at);
CREATE INDEX IF NOT EXISTS idx_query_history_user ON query_history(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
"""


class DatabaseManager:
    """PostgreSQL database manager with connection pooling."""
    
    def __init__(self):
        self.pool: Optional[Pool] = None
        self._initialized = False
    
    async def initialize(self) -> bool:
        """Initialize database connection pool and create schema."""
        if self._initialized:
            return True
        
        try:
            logger.info(f"Connecting to PostgreSQL at {DATABASE_CONFIG['host']}:{DATABASE_CONFIG['port']}")
            
            self.pool = await asyncpg.create_pool(
                host=DATABASE_CONFIG["host"],
                port=DATABASE_CONFIG["port"],
                database=DATABASE_CONFIG["database"],
                user=DATABASE_CONFIG["user"],
                password=DATABASE_CONFIG["password"],
                min_size=DATABASE_CONFIG["min_size"],
                max_size=DATABASE_CONFIG["max_size"],
            )
            
            # Create schema
            async with self.pool.acquire() as conn:
                await conn.execute(SCHEMA_SQL)
            
            self._initialized = True
            logger.info("PostgreSQL database initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            return False
    
    async def close(self):
        """Close database connection pool."""
        if self.pool:
            await self.pool.close()
            self._initialized = False
            logger.info("Database connection pool closed")
    
    @asynccontextmanager
    async def connection(self):
        """Get a database connection from the pool."""
        if not self._initialized:
            await self.initialize()
        
        async with self.pool.acquire() as conn:
            yield conn
    
    # ===== Document Operations =====
    
    async def insert_document(
        self,
        filename: str,
        file_type: str,
        file_size: int = None,
        file_hash: str = None,
        security_level: str = "public",
        language: str = "en",
        metadata: dict = None
    ) -> str:
        """Insert a new document record."""
        import json
        doc_id = str(uuid4())
        metadata_json = json.dumps(metadata or {})
        
        async with self.connection() as conn:
            await conn.execute(
                """
                INSERT INTO documents (id, filename, file_type, file_size, file_hash, 
                                       security_level, language, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                doc_id, filename, file_type, file_size, file_hash,
                security_level, language, metadata_json
            )
        
        return doc_id
    
    async def get_document(self, doc_id: str) -> Optional[Dict]:
        """Get document by ID."""
        async with self.connection() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM documents WHERE id = $1 AND is_active = TRUE",
                doc_id
            )
            return dict(row) if row else None
    
    async def get_documents(
        self,
        security_level: str = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict]:
        """Get documents with optional filtering."""
        async with self.connection() as conn:
            if security_level:
                rows = await conn.fetch(
                    """
                    SELECT * FROM documents 
                    WHERE is_active = TRUE AND security_level = $1
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                    """,
                    security_level, limit, offset
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT * FROM documents WHERE is_active = TRUE
                    ORDER BY created_at DESC
                    LIMIT $1 OFFSET $2
                    """,
                    limit, offset
                )
            return [dict(row) for row in rows]
    
    async def update_document_chunk_count(self, doc_id: str, chunk_count: int):
        """Update document chunk count after processing."""
        async with self.connection() as conn:
            await conn.execute(
                """
                UPDATE documents SET chunk_count = $1, updated_at = NOW()
                WHERE id = $2
                """,
                chunk_count, doc_id
            )
    
    async def delete_document(self, doc_id: str) -> bool:
        """Soft delete a document."""
        async with self.connection() as conn:
            result = await conn.execute(
                "UPDATE documents SET is_active = FALSE, updated_at = NOW() WHERE id = $1",
                doc_id
            )
            return "UPDATE 1" in result
    
    # ===== Chunk Operations =====
    
    async def insert_chunks_batch(self, chunks: List[Dict]) -> int:
        """Batch insert multiple chunks."""
        import json
        if not chunks:
            return 0
        
        async with self.connection() as conn:
            await conn.executemany(
                """
                INSERT INTO document_chunks 
                (id, document_id, chunk_index, chunk_text, qdrant_point_id,
                 char_start, char_end, token_count, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                """,
                [(
                    str(uuid4()),
                    c["document_id"],
                    c["chunk_index"],
                    c["chunk_text"],
                    c["qdrant_point_id"],
                    c.get("char_start"),
                    c.get("char_end"),
                    c.get("token_count"),
                    json.dumps(c.get("metadata", {}))
                ) for c in chunks]
            )
        
        return len(chunks)
    
    async def get_chunks_by_document(self, doc_id: str) -> List[Dict]:
        """Get all chunks for a document."""
        async with self.connection() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM document_chunks 
                WHERE document_id = $1 
                ORDER BY chunk_index
                """,
                doc_id
            )
            return [dict(row) for row in rows]
    
    # ===== Query History Operations =====
    
    async def log_query(
        self,
        query_text: str,
        response_text: str = None,
        sources: List[str] = None,
        language: str = "en",
        fast_mode: bool = True,
        security_clearance: str = "public",
        retrieval_time_ms: float = None,
        generation_time_ms: float = None,
        total_time_ms: float = None,
        chunks_retrieved: int = None,
        security_level: str = None,
        access_allowed: bool = True,
        user_id: str = None,
        session_id: str = None,
        metadata: dict = None
    ) -> str:
        """Log a query to history."""
        import json
        query_id = str(uuid4())
        metadata_json = json.dumps(metadata or {})
        
        async with self.connection() as conn:
            await conn.execute(
                """
                INSERT INTO query_history 
                (id, query_text, response_text, sources, language, fast_mode,
                 security_clearance, retrieval_time_ms, generation_time_ms,
                 total_time_ms, chunks_retrieved, security_level, access_allowed,
                 user_id, session_id, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
                """,
                query_id, query_text, response_text, sources or [], language,
                fast_mode, security_clearance, retrieval_time_ms, generation_time_ms,
                total_time_ms, chunks_retrieved, security_level, access_allowed,
                user_id, session_id, metadata_json
            )
        
        return query_id
    
    async def get_query_history(
        self,
        user_id: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict]:
        """Get query history."""
        async with self.connection() as conn:
            if user_id:
                rows = await conn.fetch(
                    """
                    SELECT * FROM query_history 
                    WHERE user_id = $1
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET $3
                    """,
                    user_id, limit, offset
                )
            else:
                rows = await conn.fetch(
                    """
                    SELECT * FROM query_history 
                    ORDER BY created_at DESC
                    LIMIT $1 OFFSET $2
                    """,
                    limit, offset
                )
            return [dict(row) for row in rows]
    
    async def get_query_stats(self) -> Dict:
        """Get query statistics."""
        async with self.connection() as conn:
            row = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_queries,
                    COUNT(CASE WHEN fast_mode THEN 1 END) as fast_queries,
                    COUNT(CASE WHEN NOT fast_mode THEN 1 END) as quality_queries,
                    AVG(total_time_ms) as avg_response_time,
                    AVG(retrieval_time_ms) as avg_retrieval_time,
                    AVG(generation_time_ms) as avg_generation_time,
                    COUNT(CASE WHEN access_allowed THEN 1 END) as allowed_queries,
                    COUNT(CASE WHEN NOT access_allowed THEN 1 END) as blocked_queries
                FROM query_history
                WHERE created_at > NOW() - INTERVAL '24 hours'
                """
            )
            return dict(row) if row else {}
    
    # ===== Dataset Registry Operations =====
    
    async def register_dataset(
        self,
        dataset_name: str,
        description: str = None,
        source_url: str = None,
        version: str = "1.0",
        auto_update: bool = False,
        update_frequency_days: int = 30,
        metadata: dict = None
    ) -> str:
        """Register a new dataset."""
        import json
        dataset_id = str(uuid4())
        metadata_json = json.dumps(metadata or {})
        
        async with self.connection() as conn:
            await conn.execute(
                """
                INSERT INTO dataset_registry 
                (id, dataset_name, description, source_url, version,
                 auto_update, update_frequency_days, metadata)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (dataset_name) DO UPDATE SET
                    description = EXCLUDED.description,
                    source_url = EXCLUDED.source_url,
                    version = EXCLUDED.version,
                    auto_update = EXCLUDED.auto_update,
                    update_frequency_days = EXCLUDED.update_frequency_days,
                    metadata = EXCLUDED.metadata
                """,
                dataset_id, dataset_name, description, source_url, version,
                auto_update, update_frequency_days, metadata_json
            )
        
        return dataset_id
    
    async def update_dataset_status(
        self,
        dataset_name: str,
        status: str,
        file_count: int = None,
        total_size_bytes: int = None,
        chunk_count: int = None,
        last_downloaded: datetime = None,
        last_ingested: datetime = None
    ):
        """Update dataset status after download/ingestion."""
        async with self.connection() as conn:
            await conn.execute(
                """
                UPDATE dataset_registry SET
                    status = $1,
                    file_count = COALESCE($2, file_count),
                    total_size_bytes = COALESCE($3, total_size_bytes),
                    chunk_count = COALESCE($4, chunk_count),
                    last_downloaded = COALESCE($5, last_downloaded),
                    last_ingested = COALESCE($6, last_ingested)
                WHERE dataset_name = $7
                """,
                status, file_count, total_size_bytes, chunk_count,
                last_downloaded, last_ingested, dataset_name
            )
    
    async def get_datasets(self) -> List[Dict]:
        """Get all registered datasets."""
        async with self.connection() as conn:
            rows = await conn.fetch(
                "SELECT * FROM dataset_registry ORDER BY created_at DESC"
            )
            return [dict(row) for row in rows]
    
    # ===== Audit Log Operations =====
    
    async def log_audit(
        self,
        action: str,
        resource_type: str = None,
        resource_id: str = None,
        user_id: str = None,
        ip_address: str = None,
        security_level: str = None,
        access_allowed: bool = True,
        details: dict = None
    ):
        """Log an audit event."""
        async with self.connection() as conn:
            await conn.execute(
                """
                INSERT INTO audit_log 
                (action, resource_type, resource_id, user_id, ip_address,
                 security_level, access_allowed, details)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                """,
                action, resource_type, resource_id, user_id, ip_address,
                security_level, access_allowed, details or {}
            )
    
    async def get_audit_log(
        self,
        action: str = None,
        resource_type: str = None,
        limit: int = 100
    ) -> List[Dict]:
        """Get audit log entries."""
        async with self.connection() as conn:
            if action and resource_type:
                rows = await conn.fetch(
                    """
                    SELECT * FROM audit_log 
                    WHERE action = $1 AND resource_type = $2
                    ORDER BY created_at DESC LIMIT $3
                    """,
                    action, resource_type, limit
                )
            elif action:
                rows = await conn.fetch(
                    """
                    SELECT * FROM audit_log WHERE action = $1
                    ORDER BY created_at DESC LIMIT $2
                    """,
                    action, limit
                )
            else:
                rows = await conn.fetch(
                    "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1",
                    limit
                )
            return [dict(row) for row in rows]
    
    # ===== Statistics =====
    
    async def get_system_stats(self) -> Dict:
        """Get overall system statistics."""
        async with self.connection() as conn:
            docs = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_documents,
                    COALESCE(SUM(chunk_count), 0) as total_chunks,
                    COALESCE(SUM(file_size), 0) as total_size_bytes
                FROM documents WHERE is_active = TRUE
                """
            )
            
            queries = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_queries,
                    COALESCE(AVG(total_time_ms), 0) as avg_response_time
                FROM query_history
                """
            )
            
            datasets = await conn.fetchrow(
                """
                SELECT 
                    COUNT(*) as total_datasets,
                    COALESCE(SUM(chunk_count), 0) as dataset_chunks
                FROM dataset_registry WHERE status = 'ingested'
                """
            )
            
            return {
                "documents": dict(docs) if docs else {},
                "queries": dict(queries) if queries else {},
                "datasets": dict(datasets) if datasets else {}
            }


# Global database manager instance
db_manager = DatabaseManager()
