import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeComplaint } from "@/lib/engine1";

export async function POST(request: NextRequest) {
  const { complaintId } = await request.json();

  const complaint = await prisma.complaint.findUnique({
    where: { complaintId },
  });

  if (!complaint) {
    return NextResponse.json(
      { success: false, error: "Complaint not found" },
      { status: 404 }
    );
  }

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

  return NextResponse.json(result);
}
