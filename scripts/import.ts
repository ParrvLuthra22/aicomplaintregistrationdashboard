import "dotenv/config";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { mapComplaintRow } from "../src/lib/csvImport";

const BATCH_SIZE = 2000;
const LOG_INTERVAL = 50_000;
const CHUNK_SIZE = 10 * 1024 * 1024;
const SPLIT_SEARCH_WINDOW = 50_000;

/** Matches a newline immediately followed by what looks like the start of a
 * new record (a numeric phoneNumber in column 0 followed by a comma). Used
 * to find a safe place to split a chunk without breaking a quoted field. */
const RECORD_START_RE = /\n(?=\d{6,15},)/g;

async function main() {
  const filePath = path.resolve(process.argv[2] ?? "datadump.csv");

  let total = 0;
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

  const processRow = async (row: string[]) => {
    total++;
    const mapped = mapComplaintRow(row);
    if (!mapped) {
      skipped++;
    } else {
      batch.push(mapped);
    }

    if (batch.length >= BATCH_SIZE) {
      await flush();
    }

    if (total % LOG_INTERVAL === 0) {
      console.log(
        `processed ${total} | imported ${imported} | skipped ${skipped}`
      );
    }
  };

  const fd = fs.openSync(filePath, "r");
  const fileSize = fs.fstatSync(fd).size;
  let position = 0;
  let leftover = "";

  while (position < fileSize) {
    const size = Math.min(CHUNK_SIZE, fileSize - position);
    const buf = Buffer.alloc(size);
    fs.readSync(fd, buf, 0, size, position);
    position += size;

    let text = leftover + buf.toString("utf-8");
    leftover = "";

    if (position < fileSize) {
      const searchStart = Math.max(0, text.length - SPLIT_SEARCH_WINDOW);
      const tail = text.slice(searchStart);
      let splitAt = -1;
      RECORD_START_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = RECORD_START_RE.exec(tail)) !== null) {
        splitAt = searchStart + m.index + 1;
      }
      if (splitAt !== -1) {
        leftover = text.slice(splitAt);
        text = text.slice(0, splitAt);
      }
    }

    const { data } = Papa.parse<string[]>(text, {
      header: false,
      skipEmptyLines: true,
    });

    for (const row of data) {
      await processRow(row);
    }
  }

  fs.closeSync(fd);
  await flush();

  console.log(`done: total=${total} imported=${imported} skipped=${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
