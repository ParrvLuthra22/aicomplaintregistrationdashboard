import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeComplaint } from "@/lib/engine1";

const BATCH_LIMIT = 50;
const DELAY_MS = 200;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST() {
  const complaints = await prisma.complaint.findMany({
    where: { aiProcessed: false },
    take: BATCH_LIMIT,
  });

  let processed = 0;

  for (const complaint of complaints) {
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
    await sleep(DELAY_MS);
  }

  return NextResponse.json({ processed });
}
