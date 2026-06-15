import "dotenv/config";
import fs from "fs";
import path from "path";
import Papa from "papaparse";
import type { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { mapComplaintRow } from "../src/lib/csvImport";

const BATCH_SIZE = 500;
const LOG_INTERVAL = 50_000;

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

  const stream = fs.createReadStream(filePath, { encoding: "utf-8" });

  await new Promise<void>((resolve, reject) => {
    Papa.parse<string[]>(stream, {
      header: false,
      skipEmptyLines: true,
      step: (results, parser) => {
        total++;

        const mapped = mapComplaintRow(results.data);
        if (!mapped) {
          skipped++;
        } else {
          batch.push(mapped);
        }

        if (batch.length >= BATCH_SIZE) {
          parser.pause();
          flush()
            .then(() => parser.resume())
            .catch(reject);
        }

        if (total % LOG_INTERVAL === 0) {
          console.log(
            `processed ${total} | imported ${imported} | skipped ${skipped}`
          );
        }
      },
      complete: () => {
        flush().then(resolve).catch(reject);
      },
      error: reject,
    });
  });

  console.log(`done: total=${total} imported=${imported} skipped=${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
