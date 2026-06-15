import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeComplaint } from "@/lib/engine1";

export async function POST(request: NextRequest) {
  try {
    const { complaintId } = await request.json();

    if (!complaintId) {
      return NextResponse.json(
        { success: false, error: "complaintId is required" },
        { status: 400 }
      );
    }

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
  } catch (error) {
    console.error("POST /api/engine1 failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to analyze complaint";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
