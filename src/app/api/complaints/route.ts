import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const page = Math.max(1, Number(params.get("page")) || 1);
    const limit = Math.min(
      MAX_LIMIT,
      Math.max(1, Number(params.get("limit")) || DEFAULT_LIMIT)
    );
    const search = params.get("search")?.trim();

    const where: Prisma.ComplaintWhereInput = search
      ? {
          OR: [
            { state: { contains: search, mode: "insensitive" } },
            { circle: { contains: search, mode: "insensitive" } },
            { subCategory: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    const [complaints, total] = await Promise.all([
      prisma.complaint.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          complaintId: true,
          state: true,
          subCategory: true,
          status: true,
          aiSeverity: true,
          aiSentiment: true,
          aiEscalationRisk: true,
        },
      }),
      prisma.complaint.count({ where }),
    ]);

    return NextResponse.json({
      complaints,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("GET /api/complaints failed:", error);
    const message = error instanceof Error ? error.message : "Failed to fetch complaints";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
