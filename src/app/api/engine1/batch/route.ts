import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeComplaint } from "@/lib/engine1";

const BATCH_LIMIT = 50;
const DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  try {
    const complaints = await prisma.complaint.findMany({
      where: { aiProcessed: false },
      take: BATCH_LIMIT,
    });

    let processed = 0;
    let failed = 0;

    for (const complaint of complaints) {
      try {
        const result = await analyzeComplaint(complaint);

        await prisma.complaint.update({
          where: { id: complaint.id },
          data: {
            aiSeverity: result.severity,
            aiSentiment: result.sentiment,
            aiSummary: result.summary,
            aiRootCause: result.rootCause,
            aiEscalationRisk: result.escalationRisk,
            aiProcessed: true,
            aiProcessedAt: new Date(),
          },
        });

        processed++;
      } catch (err) {
        console.error(`engine1 batch failed on ${complaint.complaintId}:`, err);
        failed++;
      }

      await sleep(DELAY_MS);
    }

    return NextResponse.json({ processed, failed, total: complaints.length });
  } catch (error) {
    console.error("POST /api/engine1/batch failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to run batch analysis";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
