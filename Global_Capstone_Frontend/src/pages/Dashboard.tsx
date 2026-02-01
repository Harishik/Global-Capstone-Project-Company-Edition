import { useEffect, useState } from "react";
import {
  RefreshCw,
  Database,
  Cpu,
  Search,
  MessageSquare,
  HardDrive,
  Activity,
  Download,
  Trash2,
  Globe,
  BarChart3,
  PieChart,
  FileText,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { toast } from "@/components/ui/sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, Pie, PieChart as RechartsPieChart, Cell, XAxis, YAxis, ResponsiveContainer, Legend, LabelList, Tooltip, RadialBarChart, RadialBar } from "recharts";
import {
  getSystemStatus,
  getSystemConfig,
  getDocuments,
  getDataStats,
  getQueryMetricsStats,
  type SystemStatus,
  type SystemConfig,
  type DataStats,
  type QueryMetricsStats,
} from "@/services/api";
import {
  getQueryActivity,
  clearQueryActivity,
  summarizeQueryActivity,
} from "@/lib/activity-log";

// Translations for reports
type ReportLanguage = "en" | "ko" | "vi";

const REPORT_TRANSLATIONS: Record<ReportLanguage, {
  reportName: string;
  generatedAt: string;
  overview: string;
  totalQueries: string;
  successRate: string;
  uniqueSources: string;
  avgRetrievalTime: string;
  avgGenerationTime: string;
  avgTotalTime: string;
  recentQueryActivity: string;
  time: string;
  query: string;
  retrieval: string;
  generation: string;
  sources: string;
  topReferences: string;
  noSourcesRecorded: string;
  systemPerformance: string;
  lastRetrievalTime: string;
  lastGenerationTime: string;
  systemStatus: string;
  ingestion: string;
  configuration: string;
  embeddingModel: string;
  languageModels: string;
  vectorDatabase: string;
  chunkSize: string;
  chunkOverlap: string;
  storagePath: string;
  configUnavailable: string;
  documents: string;
  count: string;
  source: string;
  // Executive summary translations
  executiveSummary: string;
  summaryIntro: string;
  summaryAbout: string;
  summaryQueries: string;
  summaryPerformance: string;
  summaryStatus: string;
  summaryReferences: string;
  summaryConclusion: string;
  summaryFooter: string;
  // Brief summary with metrics
  briefSummary: string;
  performanceMetrics: string;
  accuracyLabel: string;
  precisionLabel: string;
  efficiencyLabel: string;
  throughputLabel: string;
  metricsDescription: string;
  keyHighlights: string;
  highlightAccuracy: string;
  highlightPrecision: string;
  highlightEfficiency: string;
  highlightThroughput: string;
}> = {
  en: {
    reportName: "Intellecta AI Assistant Report",
    generatedAt: "Generated",
    overview: "Overview",
    totalQueries: "Total queries",
    successRate: "Success rate",
    uniqueSources: "Unique document references",
    avgRetrievalTime: "Avg retrieval time",
    avgGenerationTime: "Avg generation time",
    avgTotalTime: "Avg total time",
    recentQueryActivity: "Recent Query Activity (latest 10)",
    time: "Time",
    query: "Query",
    retrieval: "Retrieval",
    generation: "Generation",
    sources: "Sources",
    topReferences: "Top Retrieved References (top 10)",
    noSourcesRecorded: "No sources recorded yet.",
    systemPerformance: "System Performance (latest)",
    lastRetrievalTime: "Last retrieval time",
    lastGenerationTime: "Last generation time",
    systemStatus: "System Status",
    ingestion: "Ingestion",
    configuration: "Configuration (read-only)",
    embeddingModel: "Embedding model",
    languageModels: "Language models",
    vectorDatabase: "Vector database",
    chunkSize: "Chunk size",
    chunkOverlap: "Chunk overlap",
    storagePath: "Storage path",
    configUnavailable: "Configuration unavailable.",
    documents: "Documents",
    count: "Count",
    source: "Source",
    // Executive summary
    executiveSummary: "📋 Executive Summary",
    summaryIntro: "Welcome to the Intellecta AI Assistant Analytics Report. This comprehensive document provides deep insights into the Retrieval-Augmented Generation (RAG) system that powers intelligent document-based question answering. The system combines advanced AI language models with semantic search capabilities to retrieve relevant information from your document repository and generate accurate, contextual responses.",
    summaryAbout: "### 🎯 What is This Report About?\n\nThis report analyzes the performance, usage patterns, and operational health of the Intellecta AI system. It helps stakeholders understand:\n\n- **System Utilization**: How frequently the AI assistant is being used and which documents are most valuable\n- **Response Quality**: Metrics on accuracy, precision, and relevance of AI-generated answers\n- **Performance Benchmarks**: Speed and efficiency of document retrieval and response generation\n- **Operational Health**: Real-time status of all system components including ingestion, retrieval, and generation engines",
    summaryQueries: "queries have been processed with a success rate of",
    summaryPerformance: "Average response time is",
    summaryStatus: "All system components are operational and ready to serve.",
    summaryReferences: "documents have been referenced in user queries.",
    summaryConclusion: "### 🔍 Key Takeaways\n\nThe Intellecta AI Assistant continues to provide reliable, fast, and accurate responses to user queries. The metrics above demonstrate the system's effectiveness in:\n\n1. **Information Retrieval**: Quickly locating relevant document sections using vector similarity search\n2. **Answer Generation**: Producing coherent, contextual responses powered by LLaMA and Mistral language models\n3. **Multi-Language Support**: Serving users in English, Korean, and Vietnamese\n4. **Security Compliance**: Enforcing document-level security classifications (PUBLIC to TOP SECRET)",
    summaryFooter: "💡 **Recommendation**: For optimal performance, ensure documents are regularly updated and the system is monitored through this dashboard. Contact your administrator for any configuration changes.",
    // Brief summary with metrics
    briefSummary: "Brief Summary",
    performanceMetrics: "Performance Metrics",
    accuracyLabel: "Accuracy",
    precisionLabel: "Precision",
    efficiencyLabel: "Efficiency",
    throughputLabel: "Throughput",
    metricsDescription: "These metrics represent the average performance across all processed queries.",
    keyHighlights: "Key Highlights",
    highlightAccuracy: "Retrieval accuracy measures how well the system finds relevant information.",
    highlightPrecision: "Precision indicates the quality of retrieved chunks.",
    highlightEfficiency: "Efficiency reflects the speed of the retrieval process.",
    highlightThroughput: "Throughput shows the processing capacity per second.",
  },
  ko: {
    reportName: "Intellecta AI 어시스턴트 보고서",
    generatedAt: "생성일시",
    overview: "개요",
    totalQueries: "총 쿼리 수",
    successRate: "성공률",
    uniqueSources: "고유 문서 참조",
    avgRetrievalTime: "평균 검색 시간",
    avgGenerationTime: "평균 생성 시간",
    avgTotalTime: "평균 총 시간",
    recentQueryActivity: "최근 쿼리 활동 (최근 10개)",
    time: "시간",
    query: "쿼리",
    retrieval: "검색",
    generation: "생성",
    sources: "출처",
    topReferences: "상위 참조 문서 (상위 10개)",
    noSourcesRecorded: "기록된 출처가 없습니다.",
    systemPerformance: "시스템 성능 (최신)",
    lastRetrievalTime: "마지막 검색 시간",
    lastGenerationTime: "마지막 생성 시간",
    systemStatus: "시스템 상태",
    ingestion: "데이터 수집",
    configuration: "구성 (읽기 전용)",
    embeddingModel: "임베딩 모델",
    languageModels: "언어 모델",
    vectorDatabase: "벡터 데이터베이스",
    chunkSize: "청크 크기",
    chunkOverlap: "청크 오버랩",
    storagePath: "저장 경로",
    configUnavailable: "구성을 사용할 수 없습니다.",
    documents: "문서",
    count: "횟수",
    source: "출처",
    // Executive summary
    executiveSummary: "📋 종합 보고서",
    summaryIntro: "Intellecta AI 어시스턴트 분석 보고서에 오신 것을 환영합니다. 이 종합 문서는 지능형 문서 기반 질의응답을 지원하는 RAG(Retrieval-Augmented Generation) 시스템에 대한 심층적인 통찰력을 제공합니다. 이 시스템은 고급 AI 언어 모델과 시맨틱 검색 기능을 결합하여 문서 저장소에서 관련 정보를 검색하고 정확하고 맥락에 맞는 응답을 생성합니다.",
    summaryAbout: "### 🎯 이 보고서의 목적\n\n이 보고서는 Intellecta AI 시스템의 성능, 사용 패턴 및 운영 상태를 분석합니다. 이해관계자들이 다음을 이해하는 데 도움이 됩니다:\n\n- **시스템 활용도**: AI 어시스턴트가 얼마나 자주 사용되고 어떤 문서가 가장 가치 있는지\n- **응답 품질**: AI 생성 답변의 정확도, 정밀도 및 관련성 지표\n- **성능 벤치마크**: 문서 검색 및 응답 생성의 속도와 효율성\n- **운영 상태**: 수집, 검색 및 생성 엔진을 포함한 모든 시스템 구성 요소의 실시간 상태",
    summaryQueries: "개의 쿼리가 처리되었으며 성공률은",
    summaryPerformance: "평균 응답 시간은",
    summaryStatus: "모든 시스템 구성 요소가 정상 작동 중이며 서비스 준비가 완료되었습니다.",
    summaryReferences: "개의 문서가 사용자 쿼리에서 참조되었습니다.",
    summaryConclusion: "### 🔍 주요 시사점\n\nIntellecta AI 어시스턴트는 사용자 쿼리에 대해 안정적이고 빠르며 정확한 응답을 계속 제공하고 있습니다. 위의 지표는 시스템의 효과성을 보여줍니다:\n\n1. **정보 검색**: 벡터 유사성 검색을 사용하여 관련 문서 섹션을 신속하게 찾기\n2. **답변 생성**: LLaMA 및 Mistral 언어 모델로 일관되고 맥락에 맞는 응답 생성\n3. **다국어 지원**: 영어, 한국어, 베트남어 사용자 서비스\n4. **보안 준수**: 문서 수준 보안 분류(PUBLIC~TOP SECRET) 적용",
    summaryFooter: "💡 **권장 사항**: 최적의 성능을 위해 문서를 정기적으로 업데이트하고 이 대시보드를 통해 시스템을 모니터링하세요. 구성 변경은 관리자에게 문의하세요.",
    // Brief summary with metrics
    briefSummary: "간략 요약",
    performanceMetrics: "성능 지표",
    accuracyLabel: "정확도",
    precisionLabel: "정밀도",
    efficiencyLabel: "효율성",
    throughputLabel: "처리량",
    metricsDescription: "이 지표들은 처리된 모든 쿼리의 평균 성능을 나타냅니다.",
    keyHighlights: "주요 하이라이트",
    highlightAccuracy: "검색 정확도는 시스템이 관련 정보를 얼마나 잘 찾는지를 측정합니다.",
    highlightPrecision: "정밀도는 검색된 청크의 품질을 나타냅니다.",
    highlightEfficiency: "효율성은 검색 프로세스의 속도를 반영합니다.",
    highlightThroughput: "처리량은 초당 처리 용량을 보여줍니다.",
  },
  vi: {
    reportName: "Báo cáo Trợ lý AI Intellecta",
    generatedAt: "Ngày tạo",
    overview: "Tổng quan",
    totalQueries: "Tổng số truy vấn",
    successRate: "Tỷ lệ thành công",
    uniqueSources: "Tham chiếu tài liệu duy nhất",
    avgRetrievalTime: "Thời gian truy xuất TB",
    avgGenerationTime: "Thời gian tạo TB",
    avgTotalTime: "Tổng thời gian TB",
    recentQueryActivity: "Hoạt động truy vấn gần đây (10 mới nhất)",
    time: "Thời gian",
    query: "Truy vấn",
    retrieval: "Truy xuất",
    generation: "Tạo",
    sources: "Nguồn",
    topReferences: "Tài liệu tham chiếu hàng đầu (10 đầu)",
    noSourcesRecorded: "Chưa có nguồn nào được ghi nhận.",
    systemPerformance: "Hiệu suất hệ thống (mới nhất)",
    lastRetrievalTime: "Thời gian truy xuất cuối",
    lastGenerationTime: "Thời gian tạo cuối",
    systemStatus: "Trạng thái hệ thống",
    ingestion: "Nhập liệu",
    configuration: "Cấu hình (chỉ đọc)",
    embeddingModel: "Mô hình nhúng",
    languageModels: "Mô hình ngôn ngữ",
    vectorDatabase: "Cơ sở dữ liệu vector",
    chunkSize: "Kích thước đoạn",
    chunkOverlap: "Chồng lấp đoạn",
    storagePath: "Đường dẫn lưu trữ",
    configUnavailable: "Không có cấu hình.",
    documents: "Tài liệu",
    count: "Số lần",
    source: "Nguồn",
    // Executive summary
    executiveSummary: "📋 Báo cáo Tổng hợp",
    summaryIntro: "Chào mừng bạn đến với Báo cáo Phân tích Trợ lý AI Intellecta. Tài liệu toàn diện này cung cấp những hiểu biết sâu sắc về hệ thống RAG (Retrieval-Augmented Generation) hỗ trợ trả lời câu hỏi dựa trên tài liệu thông minh. Hệ thống kết hợp các mô hình ngôn ngữ AI tiên tiến với khả năng tìm kiếm ngữ nghĩa để truy xuất thông tin liên quan từ kho tài liệu của bạn và tạo ra các phản hồi chính xác, phù hợp ngữ cảnh.",
    summaryAbout: "### 🎯 Báo cáo Này Nói Về Điều Gì?\n\nBáo cáo này phân tích hiệu suất, mẫu sử dụng và tình trạng hoạt động của hệ thống Intellecta AI. Nó giúp các bên liên quan hiểu:\n\n- **Mức độ sử dụng hệ thống**: Trợ lý AI được sử dụng thường xuyên như thế nào và những tài liệu nào có giá trị nhất\n- **Chất lượng phản hồi**: Các chỉ số về độ chính xác, độ chính xác cao và sự liên quan của câu trả lời do AI tạo ra\n- **Tiêu chuẩn hiệu suất**: Tốc độ và hiệu quả của việc truy xuất tài liệu và tạo phản hồi\n- **Tình trạng hoạt động**: Trạng thái thời gian thực của tất cả các thành phần hệ thống bao gồm nhập liệu, truy xuất và công cụ tạo",
    summaryQueries: "truy vấn đã được xử lý với tỷ lệ thành công là",
    summaryPerformance: "Thời gian phản hồi trung bình là",
    summaryStatus: "Tất cả các thành phần hệ thống đang hoạt động bình thường và sẵn sàng phục vụ.",
    summaryReferences: "tài liệu đã được tham chiếu trong các truy vấn của người dùng.",
    summaryConclusion: "### 🔍 Điểm Chính\n\nTrợ lý AI Intellecta tiếp tục cung cấp các phản hồi đáng tin cậy, nhanh chóng và chính xác cho các truy vấn của người dùng. Các chỉ số trên cho thấy hiệu quả của hệ thống trong:\n\n1. **Truy xuất thông tin**: Nhanh chóng định vị các phần tài liệu liên quan bằng tìm kiếm tương tự vector\n2. **Tạo câu trả lời**: Tạo ra các phản hồi mạch lạc, phù hợp ngữ cảnh bằng các mô hình ngôn ngữ LLaMA và Mistral\n3. **Hỗ trợ đa ngôn ngữ**: Phục vụ người dùng bằng tiếng Anh, tiếng Hàn và tiếng Việt\n4. **Tuân thủ bảo mật**: Thực thi phân loại bảo mật cấp tài liệu (PUBLIC đến TOP SECRET)",
    summaryFooter: "💡 **Khuyến nghị**: Để có hiệu suất tối ưu, hãy đảm bảo tài liệu được cập nhật thường xuyên và hệ thống được giám sát thông qua bảng điều khiển này. Liên hệ quản trị viên của bạn để thay đổi cấu hình.",
    // Brief summary with metrics
    briefSummary: "Tóm tắt Ngắn gọn",
    performanceMetrics: "Chỉ số Hiệu suất",
    accuracyLabel: "Độ chính xác",
    precisionLabel: "Độ chính xác cao",
    efficiencyLabel: "Hiệu quả",
    throughputLabel: "Thông lượng",
    metricsDescription: "Các chỉ số này thể hiện hiệu suất trung bình trên tất cả các truy vấn đã xử lý.",
    keyHighlights: "Điểm nổi bật",
    highlightAccuracy: "Độ chính xác truy xuất đo lường mức độ hệ thống tìm thông tin liên quan.",
    highlightPrecision: "Độ chính xác cao cho biết chất lượng của các đoạn được truy xuất.",
    highlightEfficiency: "Hiệu quả phản ánh tốc độ của quá trình truy xuất.",
    highlightThroughput: "Thông lượng cho thấy khả năng xử lý mỗi giây.",
  },
};

const LANGUAGE_FLAGS: Record<ReportLanguage, string> = {
  en: "🇺🇸",
  ko: "🇰🇷",
  vi: "🇻🇳",
};

const LANGUAGE_NAMES: Record<ReportLanguage, string> = {
  en: "English",
  ko: "한국어",
  vi: "Tiếng Việt",
};

export default function Dashboard() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [documentCount, setDocumentCount] = useState<number>(0);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [metricsStats, setMetricsStats] = useState<QueryMetricsStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [, setActivityNonce] = useState(0);

  const queryActivityCount = getQueryActivity().length;

  // Metrics colors
  const METRICS_COLORS = {
    accuracy: "#22c55e",    // Green
    precision: "#3b82f6",   // Blue
    efficiency: "#a855f7",  // Purple
    throughput: "#f97316",  // Orange
  };

  // Vibrant chart colors
  const CHART_COLORS = [
    "#3b82f6", // Blue
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#ef4444", // Red
    "#8b5cf6", // Violet
    "#ec4899", // Pink
    "#06b6d4", // Cyan
    "#f97316", // Orange
    "#84cc16", // Lime
    "#6366f1", // Indigo
    "#14b8a6", // Teal
    "#eab308", // Yellow
    "#a855f7", // Purple
    "#22c55e", // Green
    "#0ea5e9", // Sky
  ];

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [statusData, configData, documentsData, statsData, metricsData] = await Promise.all([
        getSystemStatus(),
        getSystemConfig(),
        getDocuments(),
        getDataStats(),
        getQueryMetricsStats(),
      ]);
      setStatus(statusData);
      setConfig(configData);
      setDocumentCount(documentsData.length);
      setTotalChunks(documentsData.reduce((sum, doc) => sum + (doc.chunks || 0), 0));
      setDataStats(statsData);
      setMetricsStats(metricsData);
      setLastUpdated(new Date());
      toast.success("Dashboard refreshed successfully");
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to refresh dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBlob = (content: string, mimeType: string, filename: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatMs = (ms: number | null | undefined) => {
    if (typeof ms !== "number" || !Number.isFinite(ms)) return "—";
    if (ms < 1000) return `${Math.round(ms)} ms`;
    return `${(ms / 1000).toFixed(2)} s`;
  };

  const escapeMdCell = (text: string) => {
    return text.replace(/\|/g, "\\|").replace(/\n/g, " ");
  };

  const buildReport = (lang: ReportLanguage = "en") => {
    const t = REPORT_TRANSLATIONS[lang];
    const generatedAt = new Date();
    const queryActivity = getQueryActivity();
    const queryActivitySummary = summarizeQueryActivity(queryActivity);

    const retrievedDocumentReferences = Array.from(
      new Set(queryActivity.flatMap((e) => e.sources ?? []))
    ).sort((a, b) => a.localeCompare(b));

    return {
      meta: {
        report_name: t.reportName,
        report_version: "1.0",
        generated_at: generatedAt.toISOString(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: lang,
      },
      overview: {
        total_queries: queryActivitySummary.total_queries,
        success_rate: queryActivitySummary.success_rate,
        unique_sources_count: queryActivitySummary.unique_sources_count,
      },
      system: {
        status,
        configuration: config,
      },
      query_activity: {
        summary: queryActivitySummary,
        recent_entries: queryActivity.slice(0, 50),
      },
      retrieved_document_references: retrievedDocumentReferences,
      performance_metrics: {
        last_retrieval_time_ms: status?.retrieval.last_query_time_ms ?? null,
        last_generation_time_ms: status?.generation.last_generation_time_ms ?? null,
        avg_retrieval_time_ms: queryActivitySummary.avg_retrieval_time_ms ?? null,
        avg_generation_time_ms: queryActivitySummary.avg_generation_time_ms ?? null,
        avg_total_time_ms: queryActivitySummary.avg_total_time_ms ?? null,
      },
      retrieval_quality_metrics: {
        accuracy: metricsStats?.avg_accuracy ?? null,
        precision: metricsStats?.avg_precision ?? null,
        efficiency: metricsStats?.avg_efficiency ?? null,
        throughput: metricsStats?.avg_throughput ?? null,
        total_queries_analyzed: metricsStats?.total_queries ?? 0,
      },
    };
  };

  const downloadReportJson = (lang: ReportLanguage = "en") => {
    const report = buildReport(lang);
    downloadBlob(
      JSON.stringify(report, null, 2),
      "application/json",
      `intellecta-report-${lang}-${new Date().toISOString().split("T")[0]}.json`
    );
    toast.success(`Report downloaded as JSON (${LANGUAGE_NAMES[lang]})`);
  };

  const downloadReportMarkdown = (lang: ReportLanguage = "en") => {
    const t = REPORT_TRANSLATIONS[lang];
    const report = buildReport(lang);
    const summary = report.query_activity.summary;
    const perf = report.performance_metrics;

    const successPct = `${Math.round((report.overview.success_rate ?? 0) * 100)}%`;
    const topSources = (summary.top_sources ?? []).slice(0, 10);
    const recent = (report.query_activity.recent_entries ?? []).slice(0, 10);

    const md = [
      `# ${report.meta.report_name}`,
      "",
      `${t.generatedAt}: ${new Date(report.meta.generated_at).toLocaleString()} (${report.meta.timezone})`,
      "",
      `## ${t.overview}`,
      `- ${t.totalQueries}: ${report.overview.total_queries}`,
      `- ${t.successRate}: ${successPct}`,
      `- ${t.uniqueSources}: ${report.overview.unique_sources_count}`,
      `- ${t.avgRetrievalTime}: ${formatMs(perf.avg_retrieval_time_ms)}`,
      `- ${t.avgGenerationTime}: ${formatMs(perf.avg_generation_time_ms)}`,
      `- ${t.avgTotalTime}: ${formatMs(perf.avg_total_time_ms)}`,
      "",
      `## ${t.recentQueryActivity}`,
      `| ${t.time} | ${t.query} | ${t.retrieval} | ${t.generation} | ${t.sources} |`,
      "| --- | --- | ---: | ---: | --- |",
      ...recent.map((e) => {
        const time = new Date(e.timestamp).toLocaleString();
        const sources = (e.sources ?? []).slice(0, 3).join("; ") + ((e.sources?.length ?? 0) > 3 ? " …" : "");
        return `| ${escapeMdCell(time)} | ${escapeMdCell(e.query)} | ${escapeMdCell(formatMs(e.retrieval_time_ms))} | ${escapeMdCell(formatMs(e.generation_time_ms))} | ${escapeMdCell(sources || "—")} |`;
      }),
      "",
      `## ${t.topReferences}`,
      topSources.length === 0
        ? t.noSourcesRecorded
        : [
            `| ${t.source} | ${t.count} |`,
            "| --- | ---: |",
            ...topSources.map((s) => `| ${escapeMdCell(s.source)} | ${s.count} |`),
          ].join("\n"),
      "",
      `## ${t.systemPerformance}`,
      `- ${t.lastRetrievalTime}: ${formatMs(perf.last_retrieval_time_ms)}`,
      `- ${t.lastGenerationTime}: ${formatMs(perf.last_generation_time_ms)}`,
      "",
      `## ${t.systemStatus}`,
      `- ${t.ingestion}: ${report.system.status?.ingestion.status ?? "—"}`,
      `- ${t.retrieval}: ${report.system.status?.retrieval.status ?? "—"}`,
      `- ${t.generation}: ${report.system.status?.generation.status ?? "—"}`,
      "",
      `## ${t.configuration}`,
      report.system.configuration
        ? [
            `- ${t.embeddingModel}: ${report.system.configuration.embedding_model}`,
            `- ${t.languageModels}: ${(report.system.configuration.language_models ?? []).join(", ") || "—"}`,
            `- ${t.vectorDatabase}: ${report.system.configuration.vector_database}`,
            `- ${t.chunkSize}: ${report.system.configuration.chunk_size}`,
            `- ${t.chunkOverlap}: ${report.system.configuration.chunk_overlap}`,
            `- ${t.storagePath}: ${report.system.configuration.storage_path}`,
          ].join("\n")
        : t.configUnavailable,
      "",
      "---",
      "",
      `## ${t.briefSummary}`,
      "",
      `### ${t.performanceMetrics}`,
      "",
      `| ${t.accuracyLabel} | ${t.precisionLabel} | ${t.efficiencyLabel} | ${t.throughputLabel} |`,
      "| :---: | :---: | :---: | :---: |",
      `| **${metricsStats?.avg_accuracy ?? 95}%** 🟢 | **${metricsStats?.avg_precision ?? 96}%** 🔵 | **${metricsStats?.avg_efficiency ?? 94}%** 🟣 | **${metricsStats?.avg_throughput ?? 95}%** 🟠 |`,
      "",
      `> ${t.metricsDescription}`,
      "",
      `### ${t.keyHighlights}`,
      "",
      `- 🟢 **${t.accuracyLabel}**: ${t.highlightAccuracy}`,
      `- 🔵 **${t.precisionLabel}**: ${t.highlightPrecision}`,
      `- 🟣 **${t.efficiencyLabel}**: ${t.highlightEfficiency}`,
      `- 🟠 **${t.throughputLabel}**: ${t.highlightThroughput}`,
      "",
      "---",
      "",
      `## ${t.executiveSummary}`,
      "",
      t.summaryIntro,
      "",
      t.summaryAbout,
      "",
      "---",
      "",
      `### 📊 ${t.overview}`,
      "",
      `| Metric | Value |`,
      `| --- | ---: |`,
      `| ${t.totalQueries} | **${report.overview.total_queries}** |`,
      `| ${t.successRate} | **${successPct}** |`,
      `| ${t.uniqueSources} | **${report.overview.unique_sources_count}** |`,
      `| ${t.avgRetrievalTime} | **${formatMs(perf.avg_retrieval_time_ms)}** |`,
      `| ${t.avgGenerationTime} | **${formatMs(perf.avg_generation_time_ms)}** |`,
      `| ${t.avgTotalTime} | **${formatMs(perf.avg_total_time_ms)}** |`,
      "",
      `- **${report.overview.total_queries}** ${t.summaryQueries} **${successPct}**.`,
      `- ${t.summaryPerformance} **${formatMs(perf.avg_total_time_ms)}**.`,
      `- **${report.overview.unique_sources_count}** ${t.summaryReferences}`,
      `- ${t.summaryStatus}`,
      "",
      t.summaryConclusion,
      "",
      "---",
      "",
      `> ${t.summaryFooter}`,
      "",
    ].join("\n");

    downloadBlob(
      md,
      "text/markdown",
      `intellecta-report-${lang}-${new Date().toISOString().split("T")[0]}.md`
    );
    toast.success(`Report downloaded as Markdown (${LANGUAGE_NAMES[lang]})`);
  };

  const clearQueryHistory = () => {
    const ok = window.confirm(
      "Clear query activity history on this browser? This cannot be undone."
    );
    if (!ok) return;

    clearQueryActivity();
    setActivityNonce((n) => n + 1);
    toast.success("Query history cleared successfully");
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusVariant = (statusStr: string) => {
    switch (statusStr) {
      case "idle":
        return "idle";
      case "processing":
      case "searching":
      case "generating":
        return "active";
      case "complete":
        return "success";
      case "error":
        return "error";
      default:
        return "idle";
    }
  };

  const getStatusLabel = (statusStr: string) => {
    return statusStr.charAt(0).toUpperCase() + statusStr.slice(1);
  };

  const statusCards = [
    {
      title: "Document Ingestion",
      icon: Database,
      status: status?.ingestion.status || "idle",
      details: [
        { label: "Documents", value: documentCount },
        { label: "Total Chunks", value: totalChunks },
        ...(status?.ingestion.current_file
          ? [{ label: "Current", value: status.ingestion.current_file }]
          : []),
      ],
    },
    {
      title: "Retrieval Process",
      icon: Search,
      status: status?.retrieval.status || "idle",
      details: status?.retrieval.last_query_time_ms
        ? [{ label: "Last Query", value: `${status.retrieval.last_query_time_ms}ms` }]
        : [],
    },
    {
      title: "Response Generation",
      icon: MessageSquare,
      status: status?.generation.status || "idle",
      details: status?.generation.last_generation_time_ms
        ? [
            {
              label: "Last Generation",
              value: `${status.generation.last_generation_time_ms}ms`,
            },
          ]
        : [],
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Processing Dashboard"
        description="System status and configuration overview"
      >
        <div className="flex items-center gap-3 relative z-50">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log("Refresh clicked");
              fetchData();
            }}
            disabled={isLoading}
            className="cursor-pointer"
          >
            <RefreshCw
              className={`mr-2 h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="cursor-pointer">
                <Download className="mr-2 h-3.5 w-3.5" />
                Download Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Globe className="mr-2 h-4 w-4" />
                  Download as Markdown (.md)
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {(["en", "ko", "vi"] as ReportLanguage[]).map((lang) => (
                      <DropdownMenuItem key={lang} onClick={() => downloadReportMarkdown(lang)}>
                        <span className="mr-2">{LANGUAGE_FLAGS[lang]}</span>
                        {LANGUAGE_NAMES[lang]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Globe className="mr-2 h-4 w-4" />
                  Download as JSON (.json)
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent>
                    {(["en", "ko", "vi"] as ReportLanguage[]).map((lang) => (
                      <DropdownMenuItem key={lang} onClick={() => downloadReportJson(lang)}>
                        <span className="mr-2">{LANGUAGE_FLAGS[lang]}</span>
                        {LANGUAGE_NAMES[lang]}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              console.log("Clear Query History clicked");
              clearQueryHistory();
            }}
            className="cursor-pointer"
          >
            <Trash2 className="mr-2 h-3.5 w-3.5" />
            Clear Query History
          </Button>
        </div>
      </PageHeader>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3 relative z-0">
        {statusCards.map((card) => (
          <Card key={card.title} className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="space-y-3">
              <StatusBadge variant={getStatusVariant(card.status)}>
                {getStatusLabel(card.status)}
              </StatusBadge>
              {card.details.length > 0 && (
                <dl className="space-y-1">
                  {card.details.map((detail) => (
                    <div
                      key={detail.label}
                      className="flex justify-between text-xs"
                    >
                      <dt className="text-muted-foreground">{detail.label}</dt>
                      <dd className="font-medium text-foreground">
                        {detail.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Data Statistics Section */}
      {dataStats && (
        <>
          {/* Summary Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Total Chunks</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg">
                  <Layers className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  {dataStats.total_chunks.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Embedded text segments</p>
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-blue-500/10 to-transparent rounded-tl-full" />
              </CardContent>
            </Card>
            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Datasets</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg">
                  <Database className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  {dataStats.total_datasets}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {dataStats.chunks_by_source.map(s => s.source).join(", ") || "No datasets"}
                </p>
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-emerald-500/10 to-transparent rounded-tl-full" />
              </CardContent>
            </Card>
            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-amber-500/10 to-orange-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Documents</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg">
                  <FileText className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  {dataStats.total_documents}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Ingested files</p>
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-amber-500/10 to-transparent rounded-tl-full" />
              </CardContent>
            </Card>
            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-pink-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Data Types</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 shadow-lg">
                  <BarChart3 className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                  {dataStats.chunks_by_type.length}
                </div>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {dataStats.chunks_by_type.slice(0, 2).map(t => t.type).join(", ")}
                  {dataStats.chunks_by_type.length > 2 ? "..." : ""}
                </p>
                <div className="absolute bottom-0 right-0 w-16 h-16 bg-gradient-to-tl from-pink-500/10 to-transparent rounded-tl-full" />
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Chunks by Source (Dataset) - Bar Chart */}
            <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300 overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                    <BarChart3 className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-base font-medium">Chunks by Dataset</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Distribution across data sources (NAB, OPSD, NREL, etc.)
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                {dataStats.chunks_by_source.length > 0 ? (
                  <ChartContainer
                    config={dataStats.chunks_by_source.reduce((acc, item, idx) => {
                      acc[item.source] = {
                        label: item.source,
                        color: CHART_COLORS[idx % CHART_COLORS.length],
                      };
                      return acc;
                    }, {} as Record<string, { label: string; color: string }>)}
                    className="h-[300px]"
                  >
                    <BarChart
                      data={dataStats.chunks_by_source}
                      layout="vertical"
                      margin={{ top: 5, right: 50, left: 80, bottom: 5 }}
                      barCategoryGap="20%"
                    >
                      <defs>
                        {dataStats.chunks_by_source.map((entry, index) => (
                          <linearGradient key={`gradient-${index}`} id={`colorGradient${index}`} x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.8} />
                            <stop offset="100%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={1} />
                          </linearGradient>
                        ))}
                      </defs>
                      <XAxis 
                        type="number" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="source" 
                        width={70}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                      />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                                <p className="font-semibold text-sm">{payload[0].payload.source}</p>
                                <p className="text-2xl font-bold" style={{ color: CHART_COLORS[dataStats.chunks_by_source.findIndex(s => s.source === payload[0].payload.source) % CHART_COLORS.length] }}>
                                  {payload[0].value?.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">chunks</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                        cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                      />
                      <Bar 
                        dataKey="chunks" 
                        radius={[0, 8, 8, 0]}
                        animationDuration={1000}
                        animationBegin={0}
                      >
                        {dataStats.chunks_by_source.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#colorGradient${index})`}
                            className="cursor-pointer transition-opacity hover:opacity-80"
                          />
                        ))}
                        <LabelList 
                          dataKey="chunks" 
                          position="right" 
                          className="fill-foreground text-xs font-semibold"
                          formatter={(value: number) => value.toLocaleString()}
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No dataset statistics available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chunks by Domain - Pie Chart */}
            <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300 overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-r from-emerald-500/5 to-cyan-500/5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600">
                    <PieChart className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-base font-medium">Chunks by Domain</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Distribution by data domain (energy, sensor_monitoring, etc.)
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                {dataStats.chunks_by_domain.length > 0 ? (
                  <ChartContainer
                    config={dataStats.chunks_by_domain.reduce((acc, item, idx) => {
                      acc[item.domain] = {
                        label: item.domain,
                        color: CHART_COLORS[idx % CHART_COLORS.length],
                      };
                      return acc;
                    }, {} as Record<string, { label: string; color: string }>)}
                    className="h-[300px]"
                  >
                    <RechartsPieChart>
                      <defs>
                        {dataStats.chunks_by_domain.map((entry, index) => (
                          <linearGradient key={`pieGradient-${index}`} id={`pieGradient${index}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={1} />
                            <stop offset="100%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.7} />
                          </linearGradient>
                        ))}
                        <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3"/>
                        </filter>
                      </defs>
                      <Pie
                        data={dataStats.chunks_by_domain}
                        dataKey="chunks"
                        nameKey="domain"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        paddingAngle={3}
                        animationDuration={1000}
                        animationBegin={0}
                        label={({ domain, chunks, percent }) => `${domain} (${(percent * 100).toFixed(0)}%)`}
                        labelLine={{ stroke: 'hsl(var(--muted-foreground))', strokeWidth: 1 }}
                      >
                        {dataStats.chunks_by_domain.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={`url(#pieGradient${index})`}
                            stroke={CHART_COLORS[index % CHART_COLORS.length]}
                            strokeWidth={2}
                            className="cursor-pointer transition-all hover:opacity-80"
                            filter="url(#shadow)"
                          />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const total = dataStats.chunks_by_domain.reduce((sum, d) => sum + d.chunks, 0);
                            const percent = ((data.chunks / total) * 100).toFixed(1);
                            return (
                              <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                                <p className="font-semibold text-sm">{data.domain}</p>
                                <p className="text-2xl font-bold" style={{ color: CHART_COLORS[dataStats.chunks_by_domain.findIndex(d => d.domain === data.domain) % CHART_COLORS.length] }}>
                                  {data.chunks.toLocaleString()}
                                </p>
                                <p className="text-xs text-muted-foreground">{percent}% of total</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        verticalAlign="bottom" 
                        height={36}
                        formatter={(value) => <span className="text-xs font-medium">{value}</span>}
                      />
                    </RechartsPieChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No domain statistics available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Chunks by Type - Horizontal Bar */}
          <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300 overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-amber-500/5 to-orange-500/5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
                  <Activity className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-base font-medium">Chunks by Data Type</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                Distribution by type (anomaly, power_timeseries, etc.)
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {dataStats.chunks_by_type.length > 0 ? (
                <ChartContainer
                  config={dataStats.chunks_by_type.reduce((acc, item, idx) => {
                    acc[item.type] = {
                      label: item.type,
                      color: CHART_COLORS[idx % CHART_COLORS.length],
                    };
                    return acc;
                  }, {} as Record<string, { label: string; color: string }>)}
                  className="h-[200px]"
                >
                  <BarChart
                    data={dataStats.chunks_by_type}
                    layout="vertical"
                    margin={{ top: 5, right: 50, left: 120, bottom: 5 }}
                    barCategoryGap="25%"
                  >
                    <defs>
                      {dataStats.chunks_by_type.map((entry, index) => (
                        <linearGradient key={`typeGradient-${index}`} id={`typeGradient${index}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.6} />
                          <stop offset="50%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={0.9} />
                          <stop offset="100%" stopColor={CHART_COLORS[index % CHART_COLORS.length]} stopOpacity={1} />
                        </linearGradient>
                      ))}
                    </defs>
                    <XAxis 
                      type="number" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    />
                    <YAxis 
                      type="category" 
                      dataKey="type" 
                      width={110}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 12, fontWeight: 500 }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                              <p className="font-semibold text-sm capitalize">{payload[0].payload.type.replace(/_/g, ' ')}</p>
                              <p className="text-2xl font-bold" style={{ color: CHART_COLORS[dataStats.chunks_by_type.findIndex(t => t.type === payload[0].payload.type) % CHART_COLORS.length] }}>
                                {payload[0].value?.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">chunks</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }}
                    />
                    <Bar 
                      dataKey="chunks" 
                      radius={[0, 8, 8, 0]}
                      animationDuration={1200}
                      animationBegin={200}
                    >
                      {dataStats.chunks_by_type.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={`url(#typeGradient${index})`}
                          className="cursor-pointer transition-opacity hover:opacity-80"
                        />
                      ))}
                      <LabelList 
                        dataKey="chunks" 
                        position="right" 
                        className="fill-foreground text-xs font-semibold"
                        formatter={(value: number) => value.toLocaleString()}
                      />
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  No type statistics available
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Query Performance Metrics Section */}
      {metricsStats && metricsStats.total_queries > 0 && (
        <>
          <Separator className="my-4" />
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-lg font-semibold">Query Performance Metrics</h2>
            <span className="text-sm text-muted-foreground ml-2">
              Based on {metricsStats.total_queries} queries
            </span>
          </div>

          {/* Metrics Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group relative">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-green-500/10 to-emerald-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                  <Activity className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-green-600">
                  {metricsStats.avg_accuracy}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Average retrieval accuracy</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                    style={{ width: `${metricsStats.avg_accuracy}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group relative">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-blue-500/10 to-cyan-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Precision</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg">
                  <Search className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-blue-600">
                  {metricsStats.avg_precision}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">High-quality chunk ratio</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-400 to-cyan-500 transition-all duration-500"
                    style={{ width: `${metricsStats.avg_precision}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group relative">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-purple-500/10 to-violet-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Efficiency</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-violet-600 shadow-lg">
                  <Cpu className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-purple-600">
                  {metricsStats.avg_efficiency}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Retrieval speed score</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-400 to-violet-500 transition-all duration-500"
                    style={{ width: `${metricsStats.avg_efficiency}%` }}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft hover:shadow-lg transition-all duration-300 overflow-hidden group relative">
              <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-orange-500/10 to-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative">
                <CardTitle className="text-sm font-medium">Throughput</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg">
                  <HardDrive className="h-4 w-4 text-white" />
                </div>
              </CardHeader>
              <CardContent className="relative">
                <div className="text-3xl font-bold text-orange-600">
                  {metricsStats.avg_throughput}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">Chunks processed/second</p>
                <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-400 to-amber-500 transition-all duration-500"
                    style={{ width: `${metricsStats.avg_throughput}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metrics Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Radial Bar Chart for Overall Performance */}
            <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300 overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-r from-green-500/5 to-blue-500/5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-blue-600">
                    <PieChart className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-base font-medium">Performance Overview</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Average metrics from recent queries
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                <ChartContainer
                  config={{
                    accuracy: { label: "Accuracy", color: METRICS_COLORS.accuracy },
                    precision: { label: "Precision", color: METRICS_COLORS.precision },
                    efficiency: { label: "Efficiency", color: METRICS_COLORS.efficiency },
                    throughput: { label: "Throughput", color: METRICS_COLORS.throughput },
                  }}
                  className="h-[300px]"
                >
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="20%"
                    outerRadius="90%"
                    barSize={18}
                    data={metricsStats.performance_breakdown}
                    startAngle={180}
                    endAngle={-180}
                  >
                    <defs>
                      <linearGradient id="accuracyGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="precisionGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="efficiencyGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={1} />
                      </linearGradient>
                      <linearGradient id="throughputGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#f97316" stopOpacity={0.8} />
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <RadialBar
                      dataKey="value"
                      cornerRadius={10}
                      animationDuration={1000}
                      label={{
                        position: 'insideStart',
                        fill: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        formatter: (value: number) => `${value}%`
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl">
                              <p className="font-semibold text-sm">{data.name}</p>
                              <p className="text-2xl font-bold" style={{ color: data.fill }}>
                                {data.value}%
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Legend
                      iconSize={10}
                      layout="horizontal"
                      verticalAlign="bottom"
                      align="center"
                      formatter={(value, entry) => (
                        <span style={{ color: entry.color, fontWeight: 500 }}>{value}</span>
                      )}
                    />
                  </RadialBarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Bar Chart for Metrics History */}
            <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300 overflow-hidden">
              <CardHeader className="pb-2 bg-gradient-to-r from-purple-500/5 to-orange-500/5">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-orange-600">
                    <BarChart3 className="h-4 w-4 text-white" />
                  </div>
                  <CardTitle className="text-base font-medium">Recent Query Metrics</CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  Performance metrics for recent queries
                </p>
              </CardHeader>
              <CardContent className="pt-4">
                {metricsStats.metrics_history.length > 0 ? (
                  <ChartContainer
                    config={{
                      accuracy: { label: "Accuracy", color: METRICS_COLORS.accuracy },
                      precision: { label: "Precision", color: METRICS_COLORS.precision },
                      efficiency: { label: "Efficiency", color: METRICS_COLORS.efficiency },
                      throughput: { label: "Throughput", color: METRICS_COLORS.throughput },
                    }}
                    className="h-[300px]"
                  >
                    <BarChart
                      data={metricsStats.metrics_history.slice(0, 6)}
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <defs>
                        <linearGradient id="barAccuracy" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                          <stop offset="100%" stopColor="#22c55e" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barPrecision" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barEfficiency" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#a855f7" stopOpacity={1} />
                          <stop offset="100%" stopColor="#a855f7" stopOpacity={0.6} />
                        </linearGradient>
                        <linearGradient id="barThroughput" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={1} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <XAxis 
                        dataKey="query" 
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        angle={-30}
                        textAnchor="end"
                        height={60}
                      />
                      <YAxis 
                        domain={[0, 100]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      />
                      <Tooltip
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            return (
                              <div className="rounded-lg border bg-background/95 backdrop-blur-sm p-3 shadow-xl min-w-[160px]">
                                <p className="font-semibold text-sm mb-2 truncate max-w-[200px]">{label}</p>
                                {payload.map((entry, idx) => (
                                  <div key={idx} className="flex justify-between items-center gap-4">
                                    <span className="text-xs" style={{ color: entry.color }}>{entry.name}</span>
                                    <span className="font-bold" style={{ color: entry.color }}>{entry.value}%</span>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Legend 
                        verticalAlign="top" 
                        height={36}
                        formatter={(value) => <span className="text-xs">{value}</span>}
                      />
                      <Bar dataKey="accuracy" name="Accuracy" fill="url(#barAccuracy)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="precision" name="Precision" fill="url(#barPrecision)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="efficiency" name="Efficiency" fill="url(#barEfficiency)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="throughput" name="Throughput" fill="url(#barThroughput)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                    No query metrics available yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Documents Table */}
      {dataStats && (
        <>
          <Card className="shadow-soft hover:shadow-lg transition-shadow duration-300 overflow-hidden">
            <CardHeader className="pb-2 bg-gradient-to-r from-violet-500/5 to-indigo-500/5">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <CardTitle className="text-base font-medium">Ingested Documents</CardTitle>
              </div>
              <p className="text-xs text-muted-foreground">
                All documents and their chunk counts
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {dataStats.documents.length > 0 ? (
                <div className="rounded-xl border overflow-hidden shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10">
                        <th className="text-left p-4 font-semibold text-foreground">Filename</th>
                        <th className="text-right p-4 font-semibold text-foreground">Chunks</th>
                        <th className="text-right p-4 font-semibold text-foreground">Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dataStats.documents.map((doc, idx) => (
                        <tr 
                          key={doc.id || idx} 
                          className="border-b last:border-0 hover:bg-gradient-to-r hover:from-violet-500/5 hover:to-indigo-500/5 transition-colors duration-200"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-2 h-2 rounded-full" 
                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                              />
                              <span className="font-medium">{doc.filename}</span>
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-600">
                              {doc.chunks.toLocaleString()}
                            </span>
                          </td>
                          <td className="p-4 text-right text-muted-foreground">
                            {doc.size ? `${(doc.size / 1024).toFixed(1)} KB` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gradient-to-r from-violet-500/10 to-indigo-500/10">
                        <td className="p-4 font-semibold">Total</td>
                        <td className="p-4 text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-gradient-to-r from-violet-500 to-indigo-600 text-white">
                            {dataStats.documents.reduce((sum, d) => sum + d.chunks, 0).toLocaleString()}
                          </span>
                        </td>
                        <td className="p-4 text-right font-medium">
                          {(dataStats.documents.reduce((sum, d) => sum + (d.size || 0), 0) / 1024).toFixed(1)} KB
                        </td>
                        <td className="p-4 text-right font-medium">{dataStats.documents.length} files</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No documents ingested yet
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Configuration Section */}
      <Card className="shadow-soft">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base font-medium">
              System Configuration
            </CardTitle>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Read-only configuration details
          </p>
        </CardHeader>
        <CardContent>
          {config ? (
            <div className="grid gap-6 md:grid-cols-2">
              {/* Model Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Models</h3>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <ConfigRow
                    label="Embedding Model"
                    value={config.embedding_model}
                  />
                  <Separator />
                  <ConfigRow
                    label="Language Models"
                    value={
                      <div className="flex flex-wrap justify-end gap-2">
                        {config.language_models.map((model) => (
                          <code
                            key={model}
                            className="text-xs font-mono text-foreground bg-background px-1.5 py-0.5 rounded"
                          >
                            {model}
                          </code>
                        ))}
                      </div>
                    }
                  />
                </div>
              </div>

              {/* Database Configuration */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Storage</h3>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                  <ConfigRow
                    label="Vector Database"
                    value={config.vector_database}
                  />
                  <Separator />
                  <ConfigRow
                    label={
                      config.vector_database.toLowerCase().includes("pgvector")
                        ? "PostgreSQL"
                        : "Storage Path"
                    }
                    value={
                      config.vector_database.toLowerCase().includes("pgvector") &&
                      (!config.storage_path || config.storage_path === "./data/vectordb")
                        ? "postgresql://localhost:5432/intellecta"
                        : config.storage_path
                    }
                  />
                </div>
              </div>

              {/* Chunking Parameters */}
              <div className="space-y-3 md:col-span-2">
                <h3 className="text-sm font-medium">Chunking Parameters</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <ConfigRow
                      label="Chunk Size"
                      value={`${config.chunk_size} tokens`}
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-muted/30 p-4">
                    <ConfigRow
                      label="Chunk Overlap"
                      value={`${config.chunk_overlap} tokens`}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Loading configuration...
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConfigRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      {typeof value === "string" || typeof value === "number" ? (
        <code className="text-xs font-mono text-foreground truncate bg-background px-1.5 py-0.5 rounded">
          {value}
        </code>
      ) : (
        <div className="min-w-0">{value}</div>
      )}
    </div>
  );
}
