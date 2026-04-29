type HolidayRow = { holiday_date: string };

function toDateOnly(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function addBusinessDays(
  startDate: Date,
  businessDays: number,
  holidays: Set<string>,
): Date {
  const result = toDateOnly(startDate);
  let remaining = Math.max(0, businessDays);

  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const key = result.toISOString().slice(0, 10);
    if (!isWeekend(result) && !holidays.has(key)) {
      remaining -= 1;
    }
  }

  return result;
}

export function countBusinessDays(startDate: Date, endDate: Date, holidays: Set<string>): number {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (end < start) return 0;

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    if (!isWeekend(cursor) && !holidays.has(key)) {
      count += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return count;
}

export function holidaysToSet(rows: HolidayRow[]): Set<string> {
  return new Set(rows.map((row) => row.holiday_date));
}
