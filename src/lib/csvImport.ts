import type { Prisma } from "@prisma/client";

export const EXPECTED_COLUMNS = 34;

export function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === "null") return null;
  const date = new Date(trimmed);
  return isNaN(date.getTime()) ? null : date;
}

export function mapComplaintRow(
  row: string[]
): Prisma.ComplaintCreateManyInput | null {
  if (row.length !== EXPECTED_COLUMNS) return null;

  const get = (i: number): string | undefined => {
    const value = row[i]?.trim();
    return value ? value : undefined;
  };

  const phoneNumber = get(0);
  const status = get(1);
  const complaintId = get(3);
  const createdAt = parseDate(row[5]);

  if (!phoneNumber || !status || !complaintId || !createdAt) {
    return null;
  }

  return {
    phoneNumber,
    status,
    userRemark: get(2),
    complaintId,
    resolutionStatus: get(4),
    createdAt,
    dueDate: parseDate(row[6]),
    closedAt: parseDate(row[7]),
    state: get(8),
    district: get(9),
    city: get(10),
    direction: get(11),
    circle: get(12),
    lsa: get(13),
    channel: get(14),
    complaintType: get(15),
    technology: get(16),
    planType: get(17),
    service: get(18),
    subCategory: get(19),
    officerId: get(20),
    officerName: get(21),
    nodalRemark: get(28),
    extraInfo: get(29),
  };
}
