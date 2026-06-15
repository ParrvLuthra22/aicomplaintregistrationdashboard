import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const insights = await prisma.patternInsight.findMany({
      orderBy: { generatedAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ insights });
  } catch (error) {
    console.error("GET /api/insights failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
