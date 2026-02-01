import { useState, useEffect } from "react";
import { Send, Loader2, FileText, Clock, User, Bot, Globe, History, Trash2, X, Shield, Database, FolderOpen, Check, ToggleLeft, ToggleRight, Zap, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  queryRAG, 
  getQueryHistory, 
  deleteQueryFromHistory,
  clearQueryHistory,
  getDocuments,
  autoDetectSecurity,
  type QueryResponse as QueryResponseType,
  type QueryHistoryEntry,
  type SecurityLevel,
  type DocumentRecord,
  type SecurityAutoDetectResponse
} from "@/services/api";
import { appendQueryActivity } from "@/lib/activity-log";

interface ConversationEntry {
  id: string;
  query: string;
  response: QueryResponseType;
  timestamp: Date;
  language: string;
}

type Language = "en" | "ko" | "vi";

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "ko", label: "한국어", flag: "🇰🇷" },
  { value: "vi", label: "Tiếng Việt", flag: "🇻🇳" },
];

const SECURITY_LEVELS: { value: SecurityLevel; label: string; icon: string; color: string }[] = [
  { value: "PUBLIC", label: "Public", icon: "🌐", color: "bg-green-500/10 text-green-600" },
  { value: "INTERNAL", label: "Internal", icon: "🏢", color: "bg-blue-500/10 text-blue-600" },
  { value: "CONFIDENTIAL", label: "Confidential", icon: "🔒", color: "bg-yellow-500/10 text-yellow-600" },
  { value: "RESTRICTED", label: "Restricted", icon: "⚠️", color: "bg-orange-500/10 text-orange-600" },
  { value: "TOP_SECRET", label: "Top Secret", icon: "🔴", color: "bg-red-500/10 text-red-600" },
];

const getSecurityBadgeColor = (level: string) => {
  switch (level) {
    case "PUBLIC": return "bg-green-500/10 text-green-600 border-green-500/20";
    case "INTERNAL": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
    case "CONFIDENTIAL": return "bg-yellow-500/10 text-yellow-600 border-yellow-500/20";
    case "RESTRICTED": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
    case "TOP_SECRET": return "bg-red-500/10 text-red-600 border-red-500/20";
    default: return "bg-gray-500/10 text-gray-600 border-gray-500/20";
  }
};

export default function QueryResponse() {
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState<Language>("en");
  const [securityClearance, setSecurityClearance] = useState<SecurityLevel>("CONFIDENTIAL");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  // Document selection state
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  
  // Security mode state (auto/manual)
  const [securityMode, setSecurityMode] = useState<'auto' | 'manual'>('manual');
  const [isDetectingSecurity, setIsDetectingSecurity] = useState(false);
  const [autoDetectResult, setAutoDetectResult] = useState<SecurityAutoDetectResponse | null>(null);

  // LLM mode state (fast/quality)
  const [fastMode, setFastMode] = useState<boolean>(true); // Default to fast mode

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, []);

  // Auto-detect security when documents change and mode is auto
  useEffect(() => {
    if (securityMode === 'auto' && selectedDocIds.length > 0) {
      detectSecurityLevel();
    } else if (securityMode === 'auto' && selectedDocIds.length === 0) {
      setAutoDetectResult(null);
      setSecurityClearance('PUBLIC');
    }
  }, [selectedDocIds, securityMode]);

  const detectSecurityLevel = async () => {
    if (selectedDocIds.length === 0) return;
    
    setIsDetectingSecurity(true);
    try {
      const result = await autoDetectSecurity(selectedDocIds);
      setAutoDetectResult(result);
      setSecurityClearance(result.detected_level);
    } catch (error) {
      console.error("Failed to auto-detect security:", error);
    } finally {
      setIsDetectingSecurity(false);
    }
  };

  const toggleSecurityMode = () => {
    const newMode = securityMode === 'auto' ? 'manual' : 'auto';
    setSecurityMode(newMode);
    if (newMode === 'manual') {
      setAutoDetectResult(null);
    }
  };

  const loadDocuments = async () => {
    setIsLoadingDocs(true);
    try {
      const docs = await getDocuments();
      setDocuments(docs);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    setSelectedDocIds(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const selectAllDocuments = () => {
    if (selectedDocIds.length === documents.length) {
      setSelectedDocIds([]);
    } else {
      setSelectedDocIds(documents.map(d => d.id));
    }
  };

  // Load history when panel opens
  useEffect(() => {
    if (showHistory) {
      loadHistory();
    }
  }, [showHistory]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const data = await getQueryHistory(50);
      setHistory(data);
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await deleteQueryFromHistory(id);
      setHistory(prev => prev.filter(h => h.id !== id));
    } catch (error) {
      console.error("Failed to delete history item:", error);
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Clear all query history?")) return;
    try {
      await clearQueryHistory();
      setHistory([]);
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
  };

  const handleSelectHistoryItem = (item: QueryHistoryEntry) => {
    // Add to current conversation view
    setConversation(prev => [
      ...prev,
      {
        id: item.id,
        query: item.query,
        response: {
          answer: item.answer,
          sources: item.sources,
          retrieval_time_ms: item.retrieval_time_ms,
          generation_time_ms: item.generation_time_ms,
        },
        timestamp: new Date(item.timestamp),
        language: item.language,
      }
    ]);
    setShowHistory(false);
  };

  const handleSubmit = async () => {
    if (!query.trim() || isLoading) return;

    const currentQuery = query;
    setQuery("");
    setIsLoading(true);
    const startedAt = Date.now();

    // Pass null if no documents selected (search all), otherwise pass selected IDs
    const docFilter = selectedDocIds.length > 0 ? selectedDocIds : null;

    try {
      const response = await queryRAG(currentQuery, language, securityClearance, docFilter, fastMode);
      const endedAt = Date.now();

      appendQueryActivity({
        id: endedAt.toString(),
        timestamp: new Date(endedAt).toISOString(),
        query: currentQuery,
        sources: response.sources ?? [],
        retrieval_time_ms: response.retrieval_time_ms,
        generation_time_ms: response.generation_time_ms,
        total_time_ms: endedAt - startedAt,
        answer_length_chars: response.answer?.length ?? 0,
        success: true,
      });

      setConversation((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          query: currentQuery,
          response,
          timestamp: new Date(),
          language,
        },
      ]);
    } catch (error) {
      const endedAt = Date.now();
      appendQueryActivity({
        id: endedAt.toString(),
        timestamp: new Date(endedAt).toISOString(),
        query: currentQuery,
        sources: [],
        total_time_ms: endedAt - startedAt,
        success: false,
        error_message: error instanceof Error ? error.message : "Query failed",
      });
      console.error("Query failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Main Content */}
      <div className="flex flex-1 flex-col gap-6">
        <div className="flex items-center justify-between">
          <PageHeader
            title="Query & Response"
            description="Ask questions about your documents"
          />
          <div className="flex items-center gap-2">
            <Button
              variant={showHistory ? "default" : "outline"}
              size="sm"
              onClick={() => setShowHistory(!showHistory)}
              className="gap-2"
            >
              <History className="h-4 w-4" />
              History
            </Button>
            
            {/* Security Clearance Selector with Auto/Manual Mode */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
              {/* Mode Toggle */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={toggleSecurityMode}
                      className={`h-8 px-2 ${securityMode === 'auto' ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {securityMode === 'auto' ? (
                        <ToggleRight className="h-5 w-5" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{securityMode === 'auto' ? '🤖 Auto Mode: Detecting from document content' : '👤 Manual Mode: Select security level manually'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Separator orientation="vertical" className="h-6" />

              {/* Security Level Display/Selector */}
              {securityMode === 'auto' ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-2 px-2">
                        {isDetectingSecurity ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                            <span className="text-sm text-muted-foreground">Detecting...</span>
                          </>
                        ) : autoDetectResult ? (
                          <>
                            <Shield className="h-4 w-4 text-primary" />
                            <Badge className={getSecurityBadgeColor(autoDetectResult.detected_level)}>
                              {SECURITY_LEVELS.find(l => l.value === autoDetectResult.detected_level)?.icon}{' '}
                              {autoDetectResult.detected_level}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              ({autoDetectResult.confidence}% conf)
                            </span>
                            {autoDetectResult.findings_count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                {autoDetectResult.findings_count} findings
                              </Badge>
                            )}
                          </>
                        ) : (
                          <>
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Select documents to detect</span>
                          </>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      {autoDetectResult ? (
                        <div className="space-y-1">
                          <p className="font-medium">🔍 Auto-detected Security Level</p>
                          <p className="text-xs">{autoDetectResult.recommendation}</p>
                          {autoDetectResult.findings.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              <p className="font-medium">Findings:</p>
                              <ul className="list-disc list-inside">
                                {autoDetectResult.findings.slice(0, 3).map((f, i) => (
                                  <li key={i}>
                                    {f.type === 'keyword' 
                                      ? `Keyword: "${f.match}" (${f.level})`
                                      : `Pattern match in ${f.level}`}
                                  </li>
                                ))}
                                {autoDetectResult.findings.length > 3 && (
                                  <li>...and {autoDetectResult.findings.length - 3} more</li>
                                )}
                              </ul>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p>Select documents to auto-detect security level</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        <Select value={securityClearance} onValueChange={(v) => setSecurityClearance(v as SecurityLevel)}>
                          <SelectTrigger className="w-[140px] border-0 bg-transparent relative z-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="z-50">
                            {SECURITY_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                <span className="flex items-center gap-2">
                                  <span>{level.icon}</span>
                                  <span>{level.label}</span>
                                </span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>👤 Manual mode: Select your security clearance level</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            {/* Fast/Quality Mode Switcher */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => setFastMode(!fastMode)}
                      className={`h-8 px-3 gap-2 ${fastMode ? 'text-yellow-600' : 'text-blue-600'}`}
                    >
                      {fastMode ? (
                        <>
                          <Zap className="h-4 w-4" />
                          <span className="text-sm font-medium">Fast</span>
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4" />
                          <span className="text-sm font-medium">Quality</span>
                        </>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    {fastMode ? (
                      <div className="space-y-1">
                        <p className="font-medium">⚡ Fast Mode</p>
                        <p className="text-xs">Uses LLaMA 3 8B for all tasks</p>
                        <p className="text-xs text-muted-foreground">~30-60 seconds per query</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="font-medium">🔬 Quality Mode</p>
                        <p className="text-xs">Uses LLaMA 3 8B + Mistral 7B for better translations</p>
                        <p className="text-xs text-muted-foreground">~40-90 seconds per query</p>
                      </div>
                    )}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            
            {/* Document Selector */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 relative z-10">
                  <FolderOpen className="h-4 w-4" />
                  {selectedDocIds.length === 0 
                    ? "All Documents" 
                    : `${selectedDocIds.length} Selected`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80 z-50" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Filter by Document</h4>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        selectAllDocuments();
                      }}
                      className="h-7 text-xs cursor-pointer"
                    >
                      {selectedDocIds.length === documents.length && documents.length > 0 
                        ? "Deselect All" 
                        : "Select All"}
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {documents.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No documents available</p>
                    ) : (
                      documents.map((doc) => (
                        <div 
                          key={doc.id}
                          className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer select-none"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleDocumentSelection(doc.id);
                          }}
                        >
                          <Checkbox 
                            checked={selectedDocIds.includes(doc.id)}
                            onClick={(e) => e.stopPropagation()}
                            onCheckedChange={() => toggleDocumentSelection(doc.id)}
                            className="pointer-events-auto"
                          />
                          <div className="flex-1 min-w-0 pointer-events-none">
                            <p className="text-sm font-medium truncate">{doc.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {doc.chunk_count} chunks
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {selectedDocIds.length > 0 && (
                    <p className="text-xs text-muted-foreground border-t pt-2">
                      Query will search in {selectedDocIds.length} document{selectedDocIds.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            
            {/* Language Selector */}
            <Globe className="h-4 w-4 text-muted-foreground" />
            <Select value={language} onValueChange={(v) => setLanguage(v as Language)}>
              <SelectTrigger className="w-[140px] relative z-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-50">
                {LANGUAGES.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value}>
                    <span className="flex items-center gap-2">
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Conversation Area */}
        <Card className="flex flex-1 flex-col shadow-soft overflow-hidden">
        <CardHeader className="border-b border-border py-3 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-foreground">
                    No queries yet
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground max-w-[200px]">
                    Enter a question below to get started
                  </p>
                </div>
              ) : (
                conversation.map((entry, index) => (
                  <div key={entry.id} className="space-y-4">
                    {index > 0 && <Separator />}

                    {/* User Query */}
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <User className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 pt-0.5">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Your Query
                        </p>
                        <p className="text-sm text-foreground">{entry.query}</p>
                      </div>
                    </div>

                    {/* AI Response */}
                    <div className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <Bot className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 space-y-3 pt-0.5">
                        <p className="text-xs font-medium text-muted-foreground">
                          Response
                        </p>
                        <div className="rounded-lg bg-muted/50 border border-border p-4">
                          <p className="whitespace-pre-wrap text-sm text-foreground leading-relaxed">
                            {entry.response.answer}
                          </p>
                        </div>

                        {/* Sources */}
                        {entry.response.sources.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground">
                              Sources
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {entry.response.sources.map((source, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground"
                                >
                                  <FileText className="h-3 w-3" />
                                  {source}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Security & Keywords Info */}
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          {/* Security Level Badge */}
                          {entry.response.security && (
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getSecurityBadgeColor(entry.response.security.level)}`}
                            >
                              <Shield className="h-3 w-3 mr-1" />
                              {entry.response.security.level}
                            </Badge>
                          )}
                          
                          {/* Keywords Found Badge */}
                          {entry.response.keywords && entry.response.keywords.count > 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                                    <Database className="h-3 w-3 mr-1" />
                                    {entry.response.keywords.count} SQL mapping{entry.response.keywords.count > 1 ? 's' : ''}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-sm">
                                  <div className="space-y-1">
                                    <p className="font-medium">Matched Keywords:</p>
                                    {entry.response.keywords.mappings.map((m, i) => (
                                      <p key={i} className="text-xs">
                                        <span className="font-medium">{m.keyword}</span>: {m.description}
                                      </p>
                                    ))}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {/* Chunks Info */}
                          {(entry.response.chunks_used !== undefined || entry.response.chunks_blocked !== undefined) && (
                            <span className="text-xs text-muted-foreground">
                              {entry.response.chunks_used} chunks used
                              {entry.response.chunks_blocked ? ` (${entry.response.chunks_blocked} blocked)` : ''}
                            </span>
                          )}
                        </div>

                        {/* Timing & Model Info */}
                        <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Globe className="h-3 w-3" />
                            {LANGUAGES.find(l => l.value === entry.language)?.flag}{" "}
                            {LANGUAGES.find(l => l.value === entry.language)?.label}
                          </span>
                          {entry.response.model_used && (
                            <span className="flex items-center gap-1">
                              {entry.response.fast_mode ? (
                                <Zap className="h-3 w-3 text-yellow-500" />
                              ) : (
                                <Brain className="h-3 w-3 text-blue-500" />
                              )}
                              {entry.response.model_used}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Retrieval: {entry.response.retrieval_time_ms}ms
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Generation: {entry.response.generation_time_ms}ms
                          </span>
                        </div>
                        
                        {/* Accuracy & Precision Metrics */}
                        {entry.response.metrics && (
                          <div className="flex flex-wrap items-center gap-3 pt-2">
                            {/* Accuracy */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-14 rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-green-500 to-emerald-400 transition-all duration-500"
                                        style={{ width: `${entry.response.metrics.accuracy}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-green-600">
                                      {entry.response.metrics.accuracy}% Acc
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">🎯 Answer Accuracy</p>
                                    <p>Semantic similarity of retrieved chunks</p>
                                    <p>Avg Distance: {entry.response.metrics.avg_distance}</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* Precision */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-14 rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                                        style={{ width: `${entry.response.metrics.precision}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-blue-600">
                                      {entry.response.metrics.precision}% Prec
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">🔍 Retrieval Precision</p>
                                    <p>Quality of retrieved context chunks</p>
                                    <p>High Quality: {Math.round(entry.response.metrics.high_quality_ratio * 100)}%</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* Efficiency */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-14 rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-500"
                                        style={{ width: `${entry.response.metrics.efficiency || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-purple-600">
                                      {entry.response.metrics.efficiency || 0}% Eff
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">⚡ Retrieval Efficiency</p>
                                    <p>Speed of vector search</p>
                                    <p>Time: {entry.response.retrieval_time_ms}ms</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                            
                            {/* Throughput */}
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1.5">
                                    <div className="h-2 w-14 rounded-full bg-muted overflow-hidden">
                                      <div 
                                        className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all duration-500"
                                        style={{ width: `${entry.response.metrics.throughput || 0}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium text-orange-600">
                                      {entry.response.metrics.throughput || 0}% Thru
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <div className="text-xs space-y-1">
                                    <p className="font-medium">📊 Throughput</p>
                                    <p>Chunks processed per second</p>
                                    <p>{entry.response.metrics.chunks_per_second || 0} chunks/sec</p>
                                    <p>Analyzed: {entry.response.metrics.chunks_analyzed} chunks</p>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {/* Loading State */}
              {isLoading && (
                <div className="flex items-center gap-3 pt-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-secondary-foreground" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Generating response...
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Input Area */}
      <Card className="shadow-soft">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <Textarea
              placeholder={
                language === "ko" 
                  ? "질문을 입력하세요..." 
                  : language === "vi" 
                  ? "Nhập câu hỏi của bạn..." 
                  : "Enter your question..."
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isLoading}
              className="min-h-[72px] resize-none text-sm"
            />
            <Button
              onClick={handleSubmit}
              disabled={!query.trim() || isLoading}
              size="lg"
              className="h-auto px-5"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {language === "ko" 
              ? "Enter를 눌러 전송 • Shift+Enter로 줄바꿈" 
              : language === "vi"
              ? "Nhấn Enter để gửi • Shift+Enter để xuống dòng"
              : "Press Enter to submit • Shift+Enter for new line"}
            {" • "}
            <span className="font-medium">
              {LANGUAGES.find(l => l.value === language)?.flag} {LANGUAGES.find(l => l.value === language)?.label}
            </span>
          </p>
        </CardContent>
      </Card>
      </div>

      {/* History Sidebar */}
      {showHistory && (
        <Card className="w-80 flex flex-col shadow-soft overflow-hidden">
          <CardHeader className="border-b border-border py-3 px-4 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <History className="h-4 w-4" />
              Query History
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleClearHistory}
                title="Clear all history"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowHistory(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-0">
            <ScrollArea className="h-full">
              {isLoadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <History className="h-8 w-8 text-muted-foreground/50" />
                  <p className="mt-3 text-sm text-muted-foreground">No history yet</p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
                    Your queries will appear here
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 hover:bg-muted/50 cursor-pointer group relative"
                      onClick={() => handleSelectHistoryItem(item)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground line-clamp-2">
                            {item.query}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                            {item.answer.substring(0, 60)}...
                          </p>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground/70">
                            <span>
                              {LANGUAGES.find(l => l.value === item.language)?.flag || "🌐"}
                            </span>
                            <span>
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                            <span>
                              {new Date(item.timestamp).toLocaleTimeString([], { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteHistoryItem(item.id);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
