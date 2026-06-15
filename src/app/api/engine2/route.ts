import { NextResponse } from "next/server";
import { detectPatterns } from "@/lib/engine2";

export async function POST() {
  try {
    const insights = await detectPatterns();
    return NextResponse.json({ success: true, insights });
  } catch (error) {
    console.error("POST /api/engine2 failed:", error);
    const message =
      error instanceof Error ? error.message : "Failed to run pattern detection";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
