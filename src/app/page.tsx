"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const ACCENT = "#f59e0b";
const PAGE_SIZE = 20;

type Stats = {
  total: number;
  open: number;
  closed: number;
  aiProcessed: number;
  bySeverity: Record<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL", number>;
  bySentiment: Record<"NEUTRAL" | "FRUSTRATED" | "ANGRY" | "SATISFIED", number>;
  byCircle: { circle: string; count: number }[];
};

type Complaint = {
  id: string;
  complaintId: string;
  state: string | null;
  subCategory: string | null;
  status: string;
  aiSeverity: string | null;
  aiSentiment: string | null;
  aiEscalationRisk: number | null;
};

type Insight = {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  affectedZone: string | null;
  affectedCategory: string | null;
  affectedOfficer: string | null;
};

type ToastMessage = {
  id: number;
  text: string;
  type: "success" | "error";
};

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  MEDIUM: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  LOW: "text-green-400 bg-green-500/10 border-green-500/30",
};

const TYPE_STYLES: Record<string, string> = {
  SPIKE: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  ANOMALY: "text-purple-400 bg-purple-500/10 border-purple-500/30",
  OFFICER: "text-blue-400 bg-blue-500/10 border-blue-500/30",
  SENTIMENT_DRIFT: "text-pink-400 bg-pink-500/10 border-pink-500/30",
  SLA_RISK: "text-red-400 bg-red-500/10 border-red-500/30",
};

const SENTIMENT_COLORS: Record<string, string> = {
  NEUTRAL: "#9ca3af",
  FRUSTRATED: "#f59e0b",
  ANGRY: "#ef4444",
  SATISFIED: "#22c55e",
};

function Badge({ label, styles }: { label: string; styles?: string }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
        styles ?? "text-gray-400 bg-white/5 border-white/10"
      }`}
    >
      {label}
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className ?? ""}`} />;
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [complaintsLoading, setComplaintsLoading] = useState(true);

  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(true);

  const [refreshing, setRefreshing] = useState(false);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [runningPatternDetection, setRunningPatternDetection] = useState(false);
  const [runningBatch, setRunningBatch] = useState(false);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (text: string, type: "success" | "error" = "success") => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, text, type }]);
      setTimeout(() => {
        setToasts((t) => t.filter((toast) => toast.id !== id));
      }, 4000);
    },
    []
  );

  const dismissToast = (id: number) => {
    setToasts((t) => t.filter((toast) => toast.id !== id));
  };

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load stats");
      setStats(data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load stats", "error");
    } finally {
      setStatsLoading(false);
    }
  }, [showToast]);

  const fetchComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
      });
      if (search.trim()) params.set("search", search.trim());

      const res = await fetch(`/api/complaints?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load complaints");

      setComplaints(data.complaints);
      setTotal(data.total);
      setPages(data.pages);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load complaints", "error");
    } finally {
      setComplaintsLoading(false);
    }
  }, [page, search, showToast]);

  const fetchInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch("/api/insights");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load insights");
      setInsights(data.insights);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load insights", "error");
    } finally {
      setInsightsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStats();
    fetchInsights();
  }, [fetchStats, fetchInsights]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchComplaints();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchComplaints]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([fetchStats(), fetchComplaints(), fetchInsights()]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRunPatternDetection = async () => {
    setRunningPatternDetection(true);
    try {
      const res = await fetch("/api/engine2", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Pattern detection failed");
      await fetchInsights();
      showToast(
        `Pattern detection complete: ${data.insights?.length ?? 0} insight(s) generated`,
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Pattern detection failed", "error");
    } finally {
      setRunningPatternDetection(false);
    }
  };

  const handleRunBatchAnalysis = async () => {
    setRunningBatch(true);
    try {
      const res = await fetch("/api/engine1/batch", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Batch analysis failed");
      await Promise.all([fetchStats(), fetchComplaints()]);
      showToast(
        `Batch analysis complete: processed ${data.processed}${
          data.failed ? `, ${data.failed} failed` : ""
        } of ${data.total} complaint(s)`,
        "success"
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Batch analysis failed", "error");
    } finally {
      setRunningBatch(false);
    }
  };

  const handleAnalyze = async (complaintId: string) => {
    setAnalyzingId(complaintId);
    try {
      const res = await fetch("/api/engine1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaintId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      await Promise.all([fetchStats(), fetchComplaints()]);
      showToast(`Analyzed ${complaintId}`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Analysis failed", "error");
    } finally {
      setAnalyzingId(null);
    }
  };

  const statCards = [
    { label: "Total Complaints", value: stats?.total, icon: Inbox },
    { label: "Open", value: stats?.open, icon: Clock },
    { label: "Closed", value: stats?.closed, icon: CheckCircle2 },
    { label: "AI Processed", value: stats?.aiProcessed, icon: BrainCircuit },
  ];

  const sentimentData = stats
    ? Object.entries(stats.bySentiment)
        .map(([name, value]) => ({ name, value }))
        .filter((entry) => entry.value > 0)
    : [];

  return (
    <div className="min-h-screen bg-black text-white">
      <header className="flex flex-col gap-3 border-b border-white/10 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-amber-500" />
          <h1 className="text-lg font-semibold">Complaint AI Dashboard</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-md border border-white/10 px-3 py-2 text-sm text-gray-300 transition hover:bg-white/5 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={handleRunBatchAnalysis}
            disabled={runningBatch}
            className="flex items-center gap-2 rounded-md border border-amber-500/30 px-3 py-2 text-sm font-medium text-amber-400 transition hover:bg-amber-500/10 disabled:opacity-50"
          >
            {runningBatch ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Zap className="h-4 w-4" />
            )}
            Run Batch Analysis
          </button>
          <button
            onClick={handleRunPatternDetection}
            disabled={runningPatternDetection}
            className="flex items-center gap-2 rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-black transition hover:bg-amber-400 disabled:opacity-50"
          >
            {runningPatternDetection ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Run Pattern Detection
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">{card.label}</span>
              <card.icon className="h-5 w-5 text-amber-500" />
            </div>
            {statsLoading || card.value === undefined ? (
              <Skeleton className="mt-2 h-8 w-20" />
            ) : (
              <p className="mt-2 text-2xl font-semibold">{card.value.toLocaleString()}</p>
            )}
          </motion.div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 px-6 lg:grid-cols-5">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] lg:col-span-3">
          <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-medium text-gray-300">Complaints</h2>
            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Search state, circle, sub-category..."
                className="w-full rounded-md border border-white/10 bg-black/40 py-1.5 pl-8 pr-3 text-sm text-white placeholder:text-gray-500 focus:border-amber-500/50 focus:outline-none"
              />
            </div>
          </div>
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-black text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-2">Complaint ID</th>
                  <th className="px-4 py-2">State</th>
                  <th className="px-4 py-2">Sub-Category</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Severity</th>
                  <th className="px-4 py-2">Sentiment</th>
                  <th className="px-4 py-2">Escalation</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {complaintsLoading
                  ? Array.from({ length: PAGE_SIZE }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 8 }).map((__, j) => (
                          <td key={j} className="px-4 py-2">
                            <Skeleton className="h-4 w-full" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : complaints.map((c) => (
                      <tr key={c.id} className="hover:bg-white/5">
                        <td className="px-4 py-2 font-mono text-xs text-gray-300">
                          {c.complaintId}
                        </td>
                        <td className="px-4 py-2 text-gray-300">{c.state ?? "-"}</td>
                        <td className="px-4 py-2 text-gray-300">{c.subCategory ?? "-"}</td>
                        <td className="px-4 py-2 text-gray-300">{c.status}</td>
                        <td className="px-4 py-2">
                          {c.aiSeverity ? (
                            <Badge label={c.aiSeverity} styles={SEVERITY_STYLES[c.aiSeverity]} />
                          ) : (
                            <span className="text-gray-600">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-300">{c.aiSentiment ?? "-"}</td>
                        <td className="px-4 py-2 text-gray-300">
                          {c.aiEscalationRisk != null ? c.aiEscalationRisk.toFixed(2) : "-"}
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleAnalyze(c.complaintId)}
                            disabled={analyzingId === c.complaintId}
                            className="rounded-md border border-amber-500/30 px-2 py-1 text-xs font-medium text-amber-400 transition hover:bg-amber-500/10 disabled:opacity-50"
                          >
                            {analyzingId === c.complaintId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Analyze"
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                {!complaintsLoading && complaints.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                      No complaints found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-4 py-3 text-sm text-gray-400">
            <span>
              Page {page} of {pages} ({total.toLocaleString()} total)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || complaintsLoading}
                className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 transition hover:bg-white/5 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                disabled={page >= pages || complaintsLoading}
                className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 transition hover:bg-white/5 disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-medium text-gray-300">Pattern Insights</h2>
          <div className="flex max-h-[600px] flex-col gap-3 overflow-auto">
            {insightsLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="mb-2 flex gap-2">
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <Skeleton className="mb-2 h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))
            ) : insights.length === 0 ? (
              <p className="text-sm text-gray-500">
                No insights yet. Run Pattern Detection to generate some.
              </p>
            ) : (
              insights.map((insight, i) => (
                <motion.div
                  key={insight.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-lg border border-white/10 bg-black/40 p-3"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Badge label={insight.type} styles={TYPE_STYLES[insight.type]} />
                    <Badge label={insight.severity} styles={SEVERITY_STYLES[insight.severity]} />
                  </div>
                  <h3 className="text-sm font-medium text-white">{insight.title}</h3>
                  <p className="mt-1 text-xs text-gray-400">{insight.description}</p>
                </motion.div>
              ))
            )}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 p-6 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="mb-4 text-sm font-medium text-gray-300">Complaints by Circle</h2>
          {statsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats?.byCircle ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff1a" />
                <XAxis
                  dataKey="circle"
                  stroke="#9ca3af"
                  tick={{ fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={90}
                  interval={0}
                />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#000000",
                    border: "1px solid #ffffff20",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Bar dataKey="count" fill={ACCENT} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
          <h2 className="mb-4 text-sm font-medium text-gray-300">Sentiment Distribution</h2>
          {statsLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={sentimentData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}>
                  {sentimentData.map((entry) => (
                    <Cell key={entry.name} fill={SENTIMENT_COLORS[entry.name] ?? "#6b7280"} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#000000",
                    border: "1px solid #ffffff20",
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "#fff" }}
                />
                <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={`pointer-events-auto flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur ${
                toast.type === "success"
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-red-500/30 bg-red-500/10 text-red-300"
              }`}
            >
              {toast.type === "success" ? (
                <CheckCircle className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              <span>{toast.text}</span>
              <button
                onClick={() => dismissToast(toast.id)}
                className="ml-2 text-gray-400 transition hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
