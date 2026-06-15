import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const SENTIMENTS = ["NEUTRAL", "FRUSTRATED", "ANGRY", "SATISFIED"] as const;

export async function GET() {
  try {
    const [
      total,
      open,
      closed,
      aiProcessed,
      severityGroups,
      sentimentGroups,
      circleGroups,
    ] = await Promise.all([
      prisma.complaint.count(),
      prisma.complaint.count({ where: { closedAt: null } }),
      prisma.complaint.count({ where: { closedAt: { not: null } } }),
      prisma.complaint.count({ where: { aiProcessed: true } }),
      prisma.complaint.groupBy({
        by: ["aiSeverity"],
        where: { aiSeverity: { not: null } },
        _count: { _all: true },
      }),
      prisma.complaint.groupBy({
        by: ["aiSentiment"],
        where: { aiSentiment: { not: null } },
        _count: { _all: true },
      }),
      prisma.complaint.groupBy({
        by: ["circle"],
        where: { circle: { not: null } },
        _count: { _all: true },
      }),
    ]);

    const bySeverity = { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 };
    for (const g of severityGroups) {
      if (g.aiSeverity && (SEVERITY_LEVELS as readonly string[]).includes(g.aiSeverity)) {
        bySeverity[g.aiSeverity as keyof typeof bySeverity] = g._count._all;
      }
    }

    const bySentiment = { NEUTRAL: 0, FRUSTRATED: 0, ANGRY: 0, SATISFIED: 0 };
    for (const g of sentimentGroups) {
      if (g.aiSentiment && (SENTIMENTS as readonly string[]).includes(g.aiSentiment)) {
        bySentiment[g.aiSentiment as keyof typeof bySentiment] = g._count._all;
      }
    }

    const byCircle = circleGroups
      .map((g) => ({ circle: g.circle as string, count: g._count._all }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({
      total,
      open,
      closed,
      aiProcessed,
      bySeverity,
      bySentiment,
      byCircle,
    });
  } catch (error) {
    console.error("GET /api/stats failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch stats";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
