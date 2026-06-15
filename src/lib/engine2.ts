import { prisma } from "./prisma";
import { groq } from "./groq";

const DAY_MS = 24 * 60 * 60 * 1000;

export type PatternInsight = {
  type: "SPIKE" | "ANOMALY" | "OFFICER" | "SENTIMENT_DRIFT" | "SLA_RISK";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  affectedZone: string | null;
  affectedCategory: string | null;
  affectedOfficer: string | null;
};

type VolumeGroup = {
  circle: string | null;
  subCategory: string | null;
  currentCount: number;
  previousCount: number;
  change: number;
};

type OfficerWorkload = {
  officerId: string | null;
  officerName: string | null;
  openCount: number;
};

type SentimentGroup = { aiSentiment: string | null; count: number };

type SlaGroup = {
  circle: string | null;
  subCategory: string | null;
  count: number;
};

const SYSTEM_PROMPT = `You are a telecom network operations analyst AI. You review aggregated complaint data for an Indian telecom operator and identify actionable patterns: complaint volume spikes by region and category, officers who appear stalled or overloaded, week-over-week shifts in customer sentiment, and complaints at risk of breaching their SLA due dates. You produce concise, decision-useful insights for operations managers.`;

function formatChange(current: number, previous: number): string {
  if (previous === 0) return `new (0 -> ${current})`;
  const pct = Math.round(((current - previous) / previous) * 100);
  return `${previous} -> ${current} (${pct >= 0 ? "+" : ""}${pct}%)`;
}

function formatSentiment(groups: SentimentGroup[]): string {
  if (groups.length === 0) return "no AI-processed complaints in this window";
  return groups.map((g) => `${g.aiSentiment ?? "Unknown"}=${g.count}`).join(", ");
}

function buildPrompt(data: {
  spikes: VolumeGroup[];
  stalledOfficers: OfficerWorkload[];
  sentimentThisWeek: SentimentGroup[];
  sentimentLastWeek: SentimentGroup[];
  slaBreaches: SlaGroup[];
  slaBreachTotal: number;
}): string {
  const lines: string[] = [];

  lines.push(
    "COMPLAINT VOLUME SPIKES (last 7 days vs previous 7 days, by circle + sub-category):"
  );
  if (data.spikes.length === 0) {
    lines.push("- none detected");
  } else {
    for (const s of data.spikes) {
      lines.push(
        `- ${s.circle ?? "Unknown"} / ${s.subCategory ?? "Unknown"}: ${formatChange(s.currentCount, s.previousCount)}`
      );
    }
  }

  lines.push("");
  lines.push(
    "OFFICERS WITH ZERO CLOSURES IN THE LAST 5 DAYS (currently holding open complaints):"
  );
  if (data.stalledOfficers.length === 0) {
    lines.push("- none detected");
  } else {
    for (const o of data.stalledOfficers) {
      lines.push(
        `- ${o.officerName ?? "Unknown"} (ID ${o.officerId}): ${o.openCount} open complaints, 0 closed in last 5 days`
      );
    }
  }

  lines.push("");
  lines.push(
    "SENTIMENT DISTRIBUTION (AI-processed complaints, this week vs last week):"
  );
  lines.push(`- This week: ${formatSentiment(data.sentimentThisWeek)}`);
  lines.push(`- Last week: ${formatSentiment(data.sentimentLastWeek)}`);

  lines.push("");
  lines.push(
    `SLA RISK: complaints past due date and still open (total: ${data.slaBreachTotal}):`
  );
  if (data.slaBreaches.length === 0) {
    lines.push("- none detected");
  } else {
    for (const b of data.slaBreaches) {
      lines.push(
        `- ${b.circle ?? "Unknown"} / ${b.subCategory ?? "Unknown"}: ${b.count} overdue and unresolved`
      );
    }
  }

  lines.push("");
  lines.push(`Based on the data above, identify the most important patterns and anomalies. Respond with ONLY a JSON object (no markdown, no extra text) with this exact shape:
{
  "insights": [
    {
      "type": "SPIKE" | "ANOMALY" | "OFFICER" | "SENTIMENT_DRIFT" | "SLA_RISK",
      "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
      "title": string,
      "description": string,
      "affectedZone": string or null,
      "affectedCategory": string or null,
      "affectedOfficer": string or null
    }
  ]
}

Only include insights backed by the data above. If a section has no data, do not invent insights for it. If nothing is notable, return {"insights": []}.`);

  return lines.join("\n");
}

export async function detectPatterns(): Promise<PatternInsight[]> {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * DAY_MS);
  const fiveDaysAgo = new Date(now.getTime() - 5 * DAY_MS);

  const [
    currentVolume,
    previousVolume,
    openWorkloads,
    recentClosers,
    sentimentThisWeek,
    sentimentLastWeek,
    slaBreachGroups,
    slaBreachTotal,
  ] = await Promise.all([
    prisma.complaint.groupBy({
      by: ["circle", "subCategory"],
      where: { createdAt: { gte: sevenDaysAgo, lte: now } },
      _count: { _all: true },
    }),
    prisma.complaint.groupBy({
      by: ["circle", "subCategory"],
      where: { createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
      _count: { _all: true },
    }),
    prisma.complaint.groupBy({
      by: ["officerId", "officerName"],
      where: { officerId: { not: null }, closedAt: null },
      _count: { _all: true },
    }),
    prisma.complaint.findMany({
      where: { officerId: { not: null }, closedAt: { gte: fiveDaysAgo } },
      select: { officerId: true },
      distinct: ["officerId"],
    }),
    prisma.complaint.groupBy({
      by: ["aiSentiment"],
      where: {
        createdAt: { gte: sevenDaysAgo, lte: now },
        aiSentiment: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.complaint.groupBy({
      by: ["aiSentiment"],
      where: {
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
        aiSentiment: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.complaint.groupBy({
      by: ["circle", "subCategory"],
      where: { dueDate: { lt: now }, closedAt: null },
      _count: { _all: true },
    }),
    prisma.complaint.count({
      where: { dueDate: { lt: now }, closedAt: null },
    }),
  ]);

  const previousVolumeMap = new Map<string, number>();
  for (const g of previousVolume) {
    previousVolumeMap.set(
      `${g.circle ?? "Unknown"}|${g.subCategory ?? "Unknown"}`,
      g._count._all
    );
  }

  const spikes: VolumeGroup[] = currentVolume
    .map((g) => {
      const key = `${g.circle ?? "Unknown"}|${g.subCategory ?? "Unknown"}`;
      const previousCount = previousVolumeMap.get(key) ?? 0;
      const currentCount = g._count._all;
      return {
        circle: g.circle,
        subCategory: g.subCategory,
        currentCount,
        previousCount,
        change: currentCount - previousCount,
      };
    })
    .filter((s) => s.currentCount >= 5 && s.change > 0)
    .sort((a, b) => b.change - a.change)
    .slice(0, 15);

  const recentCloserIds = new Set(recentClosers.map((c) => c.officerId));
  const stalledOfficers: OfficerWorkload[] = openWorkloads
    .filter((o) => !recentCloserIds.has(o.officerId))
    .map((o) => ({
      officerId: o.officerId,
      officerName: o.officerName,
      openCount: o._count._all,
    }))
    .sort((a, b) => b.openCount - a.openCount)
    .slice(0, 20);

  const slaBreaches: SlaGroup[] = slaBreachGroups
    .map((g) => ({
      circle: g.circle,
      subCategory: g.subCategory,
      count: g._count._all,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const prompt = buildPrompt({
    spikes,
    stalledOfficers,
    sentimentThisWeek: sentimentThisWeek.map((g) => ({
      aiSentiment: g.aiSentiment,
      count: g._count._all,
    })),
    sentimentLastWeek: sentimentLastWeek.map((g) => ({
      aiSentiment: g.aiSentiment,
      count: g._count._all,
    })),
    slaBreaches,
    slaBreachTotal,
  });

  const completion = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as { insights?: PatternInsight[] };
  const insights = parsed.insights ?? [];

  if (insights.length > 0) {
    await prisma.patternInsight.createMany({
      data: insights.map((insight) => ({
        type: insight.type,
        severity: insight.severity,
        title: insight.title,
        description: insight.description,
        affectedZone: insight.affectedZone,
        affectedCategory: insight.affectedCategory,
        affectedOfficer: insight.affectedOfficer,
        dataWindow: "last_7_days",
      })),
    });
  }

  return insights;
}
