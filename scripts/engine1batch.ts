import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { analyzeComplaint } from "../src/lib/engine1";

const SAMPLE_SIZE = 1000;
const DELAY_MS = 1500;
const LOG_INTERVAL = 25;
const MAX_RETRIES = 5;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const complaints = await prisma.complaint.findMany({
    where: { aiProcessed: false },
    orderBy: { createdAt: "desc" },
    take: SAMPLE_SIZE,
  });

  console.log(`found ${complaints.length} unprocessed complaints`);

  let processed = 0;
  let failed = 0;

  for (const complaint of complaints) {
    for (let attempt = 0; ; attempt++) {
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
        break;
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 429 && attempt < MAX_RETRIES) {
          const backoff = DELAY_MS * 2 ** (attempt + 1);
          console.log(`rate limited, retrying in ${backoff}ms`);
          await sleep(backoff);
          continue;
        }

        console.error(`failed on ${complaint.complaintId}:`, err);
        failed++;
        break;
      }
    }

    if ((processed + failed) % LOG_INTERVAL === 0) {
      console.log(
        `processed ${processed} | failed ${failed} | total ${processed + failed}/${complaints.length}`
      );
    }

    await sleep(DELAY_MS);
  }

  console.log(`done: processed=${processed} failed=${failed}`);
  await prisma.$disconnect();
}

main();
