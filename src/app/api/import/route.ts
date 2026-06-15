import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { prisma } from "@/lib/prisma";
import { mapComplaintRow } from "@/lib/csvImport";
import type { Prisma } from "@prisma/client";

const BATCH_SIZE = 500;

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof Blob)) {
    return NextResponse.json(
      { success: false, error: "No file uploaded" },
      { status: 400 }
    );
  }

  const text = await file.text();
  const { data } = Papa.parse<string[]>(text, {
    header: false,
    skipEmptyLines: true,
  });

  let imported = 0;
  let skipped = 0;
  let batch: Prisma.ComplaintCreateManyInput[] = [];

  const flush = async () => {
    if (batch.length === 0) return;
    const result = await prisma.complaint.createMany({
      data: batch,
      skipDuplicates: true,
    });
    imported += result.count;
    skipped += batch.length - result.count;
    batch = [];
  };

  for (const row of data) {
    const mapped = mapComplaintRow(row);
    if (!mapped) {
      skipped++;
      continue;
    }

    batch.push(mapped);
    if (batch.length >= BATCH_SIZE) {
      await flush();
    }
  }

  await flush();

  return NextResponse.json({ success: true, imported, skipped });
}
