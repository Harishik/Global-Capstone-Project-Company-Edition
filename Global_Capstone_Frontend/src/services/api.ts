// API service layer for KREPS RAG System
// Interfaces with local FastAPI backend at http://localhost:8000

const API_BASE_URL = 'http://localhost:8000';

// Types
export interface IngestResponse {
  success: boolean;
  filename: string;
  chunks_created: number;
  message: string;
}

export interface IngestProgress {
  stage: 'uploading' | 'chunking' | 'embedding' | 'complete' | 'error';
  progress: number;
  message: string;
}

// Security levels matching backend
export type SecurityLevel = 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED' | 'TOP_SECRET';

export interface SecurityInfo {
  level: SecurityLevel;
  warning?: string | null;
  matched_keyword?: string | null;
  access_allowed: boolean;
}

// Auto-detect security response
export interface SecurityAutoDetectResponse {
  detected_level: SecurityLevel;
  level_value: number;
  confidence: number;
  findings_count: number;
  findings: Array<{
    type: string;
    match?: string;
    pattern?: string;
    matches?: string[];
    level: SecurityLevel;
  }>;
  recommendation: string;
}

export interface KeywordMapping {
  keyword: string;
  sql: string;
  description: string;
  data_format: string;
}

export interface KeywordInfo {
  count: number;
  mappings: KeywordMapping[];
}

export interface RetrievalMetrics {
  accuracy: number;       // 0-100% - how close retrieved chunks are
  precision: number;      // 0-100% - quality of retrieval
  efficiency: number;     // 0-100% - retrieval speed performance
  throughput: number;     // 0-100% - chunks processed per second
  avg_distance: number;   // Average vector distance
  min_distance: number;   // Best match distance
  max_distance: number;   // Worst match distance  
  high_quality_ratio: number;  // Proportion of high-quality chunks
  chunks_analyzed: number;     // Number of chunks analyzed
  chunks_per_second: number;   // Processing speed
}

export interface QueryResponse {
  answer: string;
  sources: string[];
  retrieval_time_ms: number;
  generation_time_ms: number;
  fast_mode?: boolean;
  model_used?: string;
  security?: SecurityInfo;
  keywords?: KeywordInfo;
  chunks_used?: number;
  chunks_blocked?: number;
  metrics?: RetrievalMetrics;
}

export interface SystemStatus {
  ingestion: {
    status: 'idle' | 'processing' | 'complete' | 'error';
    current_file?: string;
    documents_processed: number;
  };
  retrieval: {
    status: 'idle' | 'searching' | 'complete';
    last_query_time_ms?: number;
  };
  generation: {
    status: 'idle' | 'generating' | 'complete';
    last_generation_time_ms?: number;
  };
}

export interface SystemConfig {
  embedding_model: string;
  language_models: string[];
  vector_database: string;
  chunk_size: number;
  chunk_overlap: number;
  storage_path: string;
}

export interface DocumentRecord {
  id: string;
  filename: string;
  size: number;
  chunks: number;
  ingestedAt: Date;
  status: "ready" | "processing" | "error";
}

// Mock data for development/demo purposes
const mockDocuments: DocumentRecord[] = [
  {
    id: "1",
    filename: "research_paper.pdf",
    size: 2457600,
    chunks: 42,
    ingestedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
    status: "ready",
  },
  {
    id: "2",
    filename: "meeting_notes.docx",
    size: 156800,
    chunks: 12,
    ingestedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    status: "ready",
  },
  {
    id: "3",
    filename: "technical_spec.txt",
    size: 45200,
    chunks: 8,
    ingestedAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
    status: "ready",
  },
];
const mockStatus: SystemStatus = {
  ingestion: {
    status: 'idle',
    documents_processed: 12,
  },
  retrieval: {
    status: 'idle',
    last_query_time_ms: 245,
  },
  generation: {
    status: 'idle',
    last_generation_time_ms: 1823,
  },
};

const mockConfig: SystemConfig = {
  embedding_model: 'Qwen/Qwen3-VL-Embedding-2B',
  language_models: ['LLaMA 3.2 8B'],
  vector_database: 'Qdrant',
  chunk_size: 512,
  chunk_overlap: 50,
  storage_path: 'qdrant://localhost:6333',
};

function normalizeSystemConfig(raw: unknown): SystemConfig {
  if (!raw || typeof raw !== 'object') {
    return mockConfig;
  }

  const r = raw as Partial<SystemConfig> & { language_model?: unknown };

  const languageModels = Array.isArray(r.language_models)
    ? r.language_models.filter((m): m is string => typeof m === 'string' && m.trim().length > 0)
    : typeof r.language_model === 'string' && r.language_model.trim().length > 0
      ? [r.language_model]
      : mockConfig.language_models;

  return {
    embedding_model:
      typeof r.embedding_model === 'string' ? r.embedding_model : mockConfig.embedding_model,
    language_models: languageModels,
    vector_database:
      typeof r.vector_database === 'string' ? r.vector_database : mockConfig.vector_database,
    chunk_size: typeof r.chunk_size === 'number' ? r.chunk_size : mockConfig.chunk_size,
    chunk_overlap:
      typeof r.chunk_overlap === 'number' ? r.chunk_overlap : mockConfig.chunk_overlap,
    storage_path:
      typeof r.storage_path === 'string' ? r.storage_path : mockConfig.storage_path,
  };
}

// API Functions
export async function ingestDocument(file: File): Promise<IngestResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/ingest`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Ingestion failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Return mock response for demo/development
    console.warn('Using mock response for ingest:', error);
    await simulateDelay(2000);
    return {
      success: true,
      filename: file.name,
      chunks_created: Math.floor(Math.random() * 50) + 10,
      message: `Successfully ingested ${file.name}`,
    };
  }
}

// Batch ingest result for a single file
export interface BatchIngestFileResult {
  filename: string;
  status: 'success' | 'error';
  success: boolean;
  chunks_created: number;
  message?: string;
  error?: string;
}

// Batch ingest response
export interface BatchIngestResponse {
  total: number;
  successful: number;
  failed: number;
  results: BatchIngestFileResult[];
}

// Ingest multiple files at once
export async function ingestDocumentsBatch(files: File[]): Promise<BatchIngestResponse> {
  try {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    const response = await fetch(`${API_BASE_URL}/ingest/batch`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Batch ingestion failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Return mock response for demo/development
    console.warn('Using mock response for batch ingest:', error);
    await simulateDelay(3000);
    
    const results: BatchIngestFileResult[] = files.map((file) => ({
      filename: file.name,
      status: 'success' as const,
      success: true,
      chunks_created: Math.floor(Math.random() * 50) + 10,
      message: `Successfully ingested ${file.name}`,
    }));

    return {
      total: files.length,
      successful: files.length,
      failed: 0,
      results,
    };
  }
}

export async function queryRAG(
  query: string, 
  language: string = 'en',
  securityClearance: SecurityLevel = 'CONFIDENTIAL',
  documentIds: string[] | null = null,  // Filter by specific documents
  fastMode: boolean | null = null  // true = fast/small models, false = quality/large models, null = use default
): Promise<QueryResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        query, 
        language,
        security_clearance: securityClearance,
        document_ids: documentIds,
        fast_mode: fastMode
      }),
    });

    if (!response.ok) {
      throw new Error(`Query failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Return mock response for demo/development
    console.warn('Using mock response for query:', error);
    await simulateDelay(1500);
    return {
      answer: `This is a simulated response for the query: "${query}"\n\nIn a production environment, this would contain the actual generated response from the local LLM based on retrieved context from your ingested documents.\n\n본 시스템은 한국어 질의도 지원합니다. 문서에서 관련 정보를 검색하여 답변을 생성합니다.`,
      sources: ['document1.pdf (page 3)', 'document2.txt (chunk 7)', 'notes.docx (section 2)'],
      retrieval_time_ms: 245,
      generation_time_ms: 1823,
    };
  }
}

export async function getSystemStatus(): Promise<SystemStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/status`);

    if (!response.ok) {
      throw new Error(`Status fetch failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Return mock response for demo/development
    console.warn('Using mock response for status:', error);
    return mockStatus;
  }
}

export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const response = await fetch(`${API_BASE_URL}/config`);

    if (!response.ok) {
      throw new Error(`Config fetch failed: ${response.statusText}`);
    }

    return normalizeSystemConfig(await response.json());
  } catch (error) {
    // Return mock response for demo/development
    console.warn('Using mock response for config:', error);
    return normalizeSystemConfig(mockConfig);
  }
}

// Document management functions
export async function getDocuments(): Promise<DocumentRecord[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents`);

    if (!response.ok) {
      throw new Error(`Documents fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    // Transform backend response to match frontend DocumentRecord interface
    return data.map((doc: { id: string; filename: string; size: number; chunks: number; ingestedAt?: string; status: string }) => ({
      id: doc.id,
      filename: doc.filename,
      size: doc.size,
      chunks: doc.chunks,
      ingestedAt: doc.ingestedAt ? new Date(doc.ingestedAt) : new Date(),
      status: doc.status as "ready" | "processing" | "error"
    }));
  } catch (error) {
    // Return mock response for demo/development
    console.warn('Using mock response for documents:', error);
    return [...mockDocuments];
  }
}

export async function deleteDocument(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Delete failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    // Return mock response for demo/development
    console.warn('Using mock response for delete:', error);
    await simulateDelay(500);
    
    // Remove from mock data
    const index = mockDocuments.findIndex(doc => doc.id === id);
    if (index !== -1) {
      mockDocuments.splice(index, 1);
    }
    
    return {
      success: true,
      message: 'Document deleted successfully',
    };
  }
}

// Query History Types and Functions
export interface QueryHistoryEntry {
  id: string;
  query: string;
  language: string;
  answer: string;
  sources: string[];
  retrieval_time_ms: number;
  generation_time_ms: number;
  timestamp: string;
}

// Metrics stats for dashboard
export interface MetricsHistoryEntry {
  id: string;
  query: string;
  timestamp: string;
  accuracy: number;
  precision: number;
  efficiency: number;
  throughput: number;
}

export interface PerformanceBreakdown {
  name: string;
  value: number;
  fill: string;
}

export interface QueryMetricsStats {
  total_queries: number;
  avg_accuracy: number;
  avg_precision: number;
  avg_efficiency: number;
  avg_throughput: number;
  metrics_history: MetricsHistoryEntry[];
  performance_breakdown: PerformanceBreakdown[];
}

export async function getQueryMetricsStats(): Promise<QueryMetricsStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/query/metrics`);

    if (!response.ok) {
      throw new Error(`Metrics stats fetch failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch metrics stats:', error);
    return {
      total_queries: 0,
      avg_accuracy: 0,
      avg_precision: 0,
      avg_efficiency: 0,
      avg_throughput: 0,
      metrics_history: [],
      performance_breakdown: []
    };
  }
}

export async function getQueryHistory(limit: number = 50): Promise<QueryHistoryEntry[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/query/history?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Query history fetch failed: ${response.statusText}`);
    }

    const data = await response.json();
    // Backend returns { history: [...], total: number }
    return data.history || [];
  } catch (error) {
    console.warn('Failed to fetch query history:', error);
    return [];
  }
}

export async function clearQueryHistory(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/query/history`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Clear history failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Failed to clear query history:', error);
    return { success: false, message: 'Failed to clear history' };
  }
}

export async function deleteQueryFromHistory(queryId: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/query/history/${queryId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Delete query failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Failed to delete query from history:', error);
    return { success: false, message: 'Failed to delete query' };
  }
}

// Data Statistics Types and Functions
export interface ChunksBySource {
  source: string;
  chunks: number;
}

export interface ChunksByDomain {
  domain: string;
  chunks: number;
}

export interface ChunksByType {
  type: string;
  chunks: number;
}

export interface ChunksByDocument {
  document_id: string;
  filename: string;
  chunks: number;
}

export interface DocumentStats {
  id: string;
  filename: string;
  chunks: number;
  size: number;
  ingested_at: string;
}

export interface DataStats {
  total_chunks: number;
  total_documents: number;
  total_datasets: number;
  chunks_by_source: ChunksBySource[];
  chunks_by_domain: ChunksByDomain[];
  chunks_by_type: ChunksByType[];
  chunks_by_document: ChunksByDocument[];
  date_range: {
    earliest: string | null;
    latest: string | null;
  };
  documents: DocumentStats[];
}

export async function getDataStats(): Promise<DataStats> {
  try {
    const response = await fetch(`${API_BASE_URL}/stats`);

    if (!response.ok) {
      throw new Error(`Stats fetch failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Failed to fetch data stats:', error);
    // Return empty stats on error
    return {
      total_chunks: 0,
      total_documents: 0,
      total_datasets: 0,
      chunks_by_source: [],
      chunks_by_domain: [],
      chunks_by_type: [],
      chunks_by_document: [],
      date_range: { earliest: null, latest: null },
      documents: []
    };
  }
}

// Auto-detect security level for selected documents
export async function autoDetectSecurity(documentIds: string[]): Promise<SecurityAutoDetectResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/security/auto-detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ document_ids: documentIds }),
    });

    if (!response.ok) {
      throw new Error(`Security auto-detect failed: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Failed to auto-detect security:', error);
    // Return default PUBLIC level on error
    return {
      detected_level: 'PUBLIC',
      level_value: 1,
      confidence: 0,
      findings_count: 0,
      findings: [],
      recommendation: 'Unable to analyze documents. Defaulting to PUBLIC access.'
    };
  }
}

// Utility function for simulating network delay
function simulateDelay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
