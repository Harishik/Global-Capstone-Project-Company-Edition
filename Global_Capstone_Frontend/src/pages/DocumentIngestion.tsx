import { useState, useCallback, useEffect } from "react";
import { FileUp, File, CheckCircle, XCircle, Loader2, X, Files } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { DocumentHistory, type IngestedDocument } from "@/components/DocumentHistory";
import { 
  ingestDocument, 
  ingestDocumentsBatch,
  getDocuments, 
  deleteDocument,
  type IngestResponse,
  type DocumentRecord,
  type BatchIngestResponse 
} from "@/services/api";

type IngestionStage = "idle" | "uploading" | "chunking" | "embedding" | "complete" | "error";

interface IngestionState {
  stage: IngestionStage;
  progress: number;
  message: string;
  result?: IngestResponse;
  batchResult?: BatchIngestResponse;
}

const VALID_EXTENSIONS = [".pdf", ".txt", ".docx", ".md", ".csv", ".hwp", ".mcr"];
const VALID_TYPES = [
  "application/pdf",
  "text/plain",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/markdown",
  "text/csv",
  "application/x-hwp",
  "application/haansofthwp",
  "application/octet-stream",
];

export default function DocumentIngestion() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [documents, setDocuments] = useState<IngestedDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [ingestionState, setIngestionState] = useState<IngestionState>({
    stage: "idle",
    progress: 0,
    message: "",
  });

  // Fetch documents on mount
  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const docs = await getDocuments();
        setDocuments(docs.map((doc: DocumentRecord) => ({
          ...doc,
          ingestedAt: new Date(doc.ingestedAt),
        })));
      } catch (error) {
        console.error("Failed to fetch documents:", error);
      } finally {
        setIsLoadingDocs(false);
      }
    };
    fetchDocuments();
  }, []);

  const isValidFileType = (file: File): boolean => {
    return (
      VALID_TYPES.includes(file.type) ||
      VALID_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext))
    );
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files).filter(isValidFileType);
    if (droppedFiles.length > 0) {
      setSelectedFiles((prev) => {
        // Avoid duplicates by filename
        const existingNames = new Set(prev.map((f) => f.name));
        const newFiles = droppedFiles.filter((f) => !existingNames.has(f.name));
        return [...prev, ...newFiles];
      });
      setIngestionState({ stage: "idle", progress: 0, message: "" });
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(isValidFileType);
    if (files.length > 0) {
      setSelectedFiles((prev) => {
        const existingNames = new Set(prev.map((f) => f.name));
        const newFiles = files.filter((f) => !existingNames.has(f.name));
        return [...prev, ...newFiles];
      });
      setIngestionState({ stage: "idle", progress: 0, message: "" });
    }
    // Reset input to allow selecting same file again
    e.target.value = "";
  }, []);

  const removeFile = useCallback((fileName: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== fileName));
  }, []);

  const simulateProgress = async (fileCount: number = 1) => {
    const stages: Array<{ stage: IngestionStage; msg: string; end: number }> = [
      { stage: "uploading", msg: `Uploading ${fileCount} document${fileCount > 1 ? 's' : ''}...`, end: 30 },
      { stage: "chunking", msg: "Splitting into chunks...", end: 60 },
      { stage: "embedding", msg: "Generating embeddings...", end: 90 },
    ];

    for (const { stage, msg, end } of stages) {
      setIngestionState((prev) => ({ ...prev, stage, message: msg }));
      const start = stage === "uploading" ? 0 : stage === "chunking" ? 30 : 60;
      for (let i = start; i <= end; i += 10) {
        await new Promise((r) => setTimeout(r, stage === "embedding" ? 400 : 250));
        setIngestionState((prev) => ({ ...prev, progress: i }));
      }
    }
  };

  const handleIngest = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const progressPromise = simulateProgress(selectedFiles.length);
      
      if (selectedFiles.length === 1) {
        // Single file ingestion
        const result = await ingestDocument(selectedFiles[0]);
        await progressPromise;

        const newDoc: IngestedDocument = {
          id: `${Date.now()}`,
          filename: result.filename,
          size: selectedFiles[0].size,
          chunks: result.chunks_created,
          ingestedAt: new Date(),
          status: "ready",
        };
        setDocuments((prev) => [newDoc, ...prev]);

        setIngestionState({
          stage: "complete",
          progress: 100,
          message: result.message,
          result,
        });
      } else {
        // Batch ingestion
        const batchResult = await ingestDocumentsBatch(selectedFiles);
        await progressPromise;

        // Add successful documents to history
        const newDocs: IngestedDocument[] = batchResult.results
          .filter((r) => r.status === 'success')
          .map((r, idx) => {
            const file = selectedFiles.find((f) => f.name === r.filename);
            return {
              id: `${Date.now()}-${idx}`,
              filename: r.filename,
              size: file?.size || 0,
              chunks: r.chunks_created,
              ingestedAt: new Date(),
              status: "ready" as const,
            };
          });
        
        setDocuments((prev) => [...newDocs, ...prev]);

        setIngestionState({
          stage: "complete",
          progress: 100,
          message: `Ingested ${batchResult.successful} of ${batchResult.total} files`,
          batchResult,
        });
      }
    } catch (error) {
      setIngestionState({
        stage: "error",
        progress: 0,
        message: error instanceof Error ? error.message : "Ingestion failed",
      });
    }
  };

  const handleDeleteDocument = async (id: string) => {
    try {
      await deleteDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (error) {
      console.error("Failed to delete document:", error);
    }
  };

  const resetState = () => {
    setSelectedFiles([]);
    setIngestionState({ stage: "idle", progress: 0, message: "" });
  };

  const isProcessing =
    ingestionState.stage !== "idle" &&
    ingestionState.stage !== "complete" &&
    ingestionState.stage !== "error";

  const totalSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

  const processingStages = [
    { key: "uploading", label: "Upload", step: 1 },
    { key: "chunking", label: "Chunking", step: 2 },
    { key: "embedding", label: "Embedding", step: 3 },
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Document Ingestion"
        description="Upload documents to add them to the knowledge base"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upload Card */}
        <Card className="shadow-soft">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              Upload Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 transition-colors ${
                isDragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/50"
              }`}
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Files className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="mt-4 text-sm font-medium text-foreground">
                Drop files here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDF, TXT, DOCX, MD, CSV, HWP, MCR • Multiple files supported
              </p>
              <input
                type="file"
                accept=".pdf,.txt,.docx,.md,.csv,.hwp,.mcr"
                onChange={handleFileSelect}
                multiple
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Total: {(totalSize / 1024).toFixed(1)} KB
                  </p>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-2">
                  {selectedFiles.map((file, idx) => (
                    <div 
                      key={`${file.name}-${idx}`}
                      className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-2"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <File className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7"
                        onClick={() => removeFile(file.name)}
                        disabled={isProcessing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={handleIngest} 
                  disabled={isProcessing} 
                  className="w-full"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <FileUp className="mr-2 h-4 w-4" />
                      Ingest {selectedFiles.length} File{selectedFiles.length > 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card className="shadow-soft">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-medium">
              Ingestion Status
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress Steps */}
            <div className="space-y-3">
              {processingStages.map(({ key, label, step }) => {
                const isActive = ingestionState.stage === key;
                const stageOrder = ["uploading", "chunking", "embedding", "complete"];
                const currentIdx = stageOrder.indexOf(ingestionState.stage);
                const stepIdx = stageOrder.indexOf(key);
                const isComplete = currentIdx > stepIdx;

                return (
                  <div key={key} className="flex items-center gap-3">
                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                        isComplete
                          ? "bg-success text-success-foreground"
                          : isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isActive ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : isComplete ? (
                        <CheckCircle className="h-3.5 w-3.5" />
                      ) : (
                        step
                      )}
                    </div>
                    <span
                      className={`text-sm ${
                        isActive || isComplete
                          ? "text-foreground font-medium"
                          : "text-muted-foreground"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Progress Bar */}
            {ingestionState.stage !== "idle" && (
              <div className="space-y-2">
                <Progress value={ingestionState.progress} className="h-1.5" />
                <p className="text-xs text-muted-foreground">
                  {ingestionState.message}
                </p>
              </div>
            )}

            {/* Success Result */}
            {ingestionState.stage === "complete" && (ingestionState.result || ingestionState.batchResult) && (
              <div className="rounded-lg border border-success/30 bg-success/5 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="mt-0.5 h-4 w-4 text-success" />
                  <div className="flex-1 space-y-2">
                    <p className="text-sm font-medium text-foreground">
                      Ingestion Complete
                    </p>
                    
                    {/* Single file result */}
                    {ingestionState.result && !ingestionState.batchResult && (
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">File</dt>
                        <dd className="text-foreground truncate">
                          {ingestionState.result.filename}
                        </dd>
                        <dt className="text-muted-foreground">Chunks</dt>
                        <dd className="text-foreground">
                          {ingestionState.result.chunks_created}
                        </dd>
                        <dt className="text-muted-foreground">Status</dt>
                        <dd>
                          <StatusBadge variant="success" className="mt-0.5">
                            Ready
                          </StatusBadge>
                        </dd>
                      </dl>
                    )}
                    
                    {/* Batch result */}
                    {ingestionState.batchResult && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-success" />
                            {ingestionState.batchResult.successful} succeeded
                          </span>
                          {ingestionState.batchResult.failed > 0 && (
                            <span className="flex items-center gap-1">
                              <XCircle className="h-3 w-3 text-destructive" />
                              {ingestionState.batchResult.failed} failed
                            </span>
                          )}
                        </div>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {ingestionState.batchResult.results.map((r, idx) => (
                            <div 
                              key={idx}
                              className={`flex items-center justify-between rounded px-2 py-1 text-xs ${
                                r.status === 'success' ? 'bg-success/10' : 'bg-destructive/10'
                              }`}
                            >
                              <span className="truncate flex-1">{r.filename}</span>
                              <span className="ml-2">
                                {r.status === 'success' 
                                  ? `${r.chunks_created} chunks`
                                  : r.error || 'Failed'
                                }
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetState}
                      className="mt-2"
                    >
                      Ingest More Files
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Error Result */}
            {ingestionState.stage === "error" && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="mt-0.5 h-4 w-4 text-destructive" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Ingestion Failed
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {ingestionState.message}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={resetState}
                      className="mt-3"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Empty State */}
            {ingestionState.stage === "idle" && (
              <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border">
                <p className="text-xs text-muted-foreground">
                  Select a document to begin
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Document History Panel */}
      <DocumentHistory
        documents={documents}
        onDelete={handleDeleteDocument}
        isLoading={isLoadingDocs}
      />
    </div>
  );
}
