import { groq } from "./groq";

export type ComplaintInput = {
  userRemark: string | null;
  nodalRemark: string | null;
  subCategory: string | null;
  circle: string | null;
  state: string | null;
  dueDate: Date | null;
  createdAt: Date;
  status: string;
};

export type AnalysisResult = {
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  sentiment: "NEUTRAL" | "FRUSTRATED" | "ANGRY" | "SATISFIED";
  summary: string;
  rootCause: string;
  escalationRisk: number;
};

const SYSTEM_PROMPT = `You are a telecom complaint analysis AI. You analyze customer complaint records for an Indian telecom operator and assess their severity, the customer's sentiment, a concise summary, the likely root cause, and the risk that the complaint will escalate (e.g. to a nodal officer, regulator, or media) if not addressed promptly.`;

function buildUserPrompt(complaint: ComplaintInput): string {
  return `Analyze the following telecom complaint and respond with ONLY a JSON object (no markdown, no extra text) with this exact shape:
{
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "sentiment": "NEUTRAL" | "FRUSTRATED" | "ANGRY" | "SATISFIED",
  "summary": string (one sentence),
  "rootCause": string (one sentence),
  "escalationRisk": number (between 0 and 1)
}

Complaint details:
- Status: ${complaint.status}
- Sub-category: ${complaint.subCategory ?? "N/A"}
- Circle: ${complaint.circle ?? "N/A"}
- State: ${complaint.state ?? "N/A"}
- Created At: ${complaint.createdAt.toISOString()}
- Due Date: ${complaint.dueDate ? complaint.dueDate.toISOString() : "N/A"}
- User Remark: ${complaint.userRemark ?? "N/A"}
- Nodal Remark: ${complaint.nodalRemark ?? "N/A"}`;
}

export async function analyzeComplaint(
  complaint: ComplaintInput
): Promise<AnalysisResult> {
  const completion = await groq.chat.completions.create({
    model: "llama3-8b-8192",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(complaint) },
    ],
  });

  const content = completion.choices[0]?.message?.content ?? "";
  return JSON.parse(content) as AnalysisResult;
}
