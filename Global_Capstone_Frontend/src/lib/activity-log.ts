export interface QueryActivityEntry {
  id: string;
  timestamp: string; // ISO
  query: string;
  sources: string[];
  retrieval_time_ms?: number;
  generation_time_ms?: number;
  total_time_ms?: number;
  answer_length_chars?: number;
  success: boolean;
  error_message?: string;
}

const STORAGE_KEY = "intellecta.queryActivity.v1";
const MAX_ENTRIES = 200;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getQueryActivity(): QueryActivityEntry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter((e): e is QueryActivityEntry => !!e && typeof e === "object");
  } catch {
    return [];
  }
}

export function appendQueryActivity(entry: QueryActivityEntry) {
  if (!canUseStorage()) return;

  const current = getQueryActivity();
  const next = [entry, ...current].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function clearQueryActivity() {
  if (!canUseStorage()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export interface QueryActivitySummary {
  total_queries: number;
  success_rate: number; // 0..1
  avg_retrieval_time_ms?: number;
  avg_generation_time_ms?: number;
  avg_total_time_ms?: number;
  unique_sources_count: number;
  top_sources: Array<{ source: string; count: number }>;
}

function avg(nums: number[]) {
  if (nums.length === 0) return undefined;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

export function summarizeQueryActivity(entries: QueryActivityEntry[]): QueryActivitySummary {
  const total = entries.length;
  const successCount = entries.filter((e) => e.success).length;

  const retrieval = entries
    .map((e) => e.retrieval_time_ms)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const generation = entries
    .map((e) => e.generation_time_ms)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
  const totalTimes = entries
    .map((e) => e.total_time_ms)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const s of e.sources ?? []) {
      counts.set(s, (counts.get(s) ?? 0) + 1);
    }
  }

  const top_sources = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([source, count]) => ({ source, count }));

  return {
    total_queries: total,
    success_rate: total === 0 ? 0 : successCount / total,
    avg_retrieval_time_ms: avg(retrieval),
    avg_generation_time_ms: avg(generation),
    avg_total_time_ms: avg(totalTimes),
    unique_sources_count: counts.size,
    top_sources,
  };
}
