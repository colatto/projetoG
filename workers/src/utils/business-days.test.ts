import { describe, expect, it } from 'vitest';
import { addBusinessDays, countBusinessDays, holidaysToSet } from './business-days.js';

describe('business-days utils', () => {
  function localDate(year: number, month: number, day: number): Date {
    return new Date(year, month - 1, day);
  }

  it('counts only working days excluding weekends and holidays', () => {
    const holidays = holidaysToSet([{ holiday_date: '2026-04-21' }]);
    const start = localDate(2026, 4, 20); // Monday
    const end = localDate(2026, 4, 24); // Friday

    const result = countBusinessDays(start, end, holidays);

    expect(result).toBe(4);
  });

  it('adds business days skipping weekend and holiday', () => {
    const holidays = holidaysToSet([{ holiday_date: '2026-04-21' }]);
    const start = localDate(2026, 4, 20); // Monday

    const result = addBusinessDays(start, 2, holidays);

    expect(result.toISOString().slice(0, 10)).toBe('2026-04-23');
  });

  it('returns zero when endDate is before startDate', () => {
    const holidays = holidaysToSet([]);
    const start = localDate(2026, 4, 25);
    const end = localDate(2026, 4, 20);

    expect(countBusinessDays(start, end, holidays)).toBe(0);
  });

  it('keeps the same day when adding zero business days', () => {
    const holidays = holidaysToSet([{ holiday_date: '2026-04-21' }]);
    const start = localDate(2026, 4, 20);

    const result = addBusinessDays(start, 0, holidays);
    expect(result.toISOString().slice(0, 10)).toBe('2026-04-20');
  });

  it('handles start equals end in business-day count', () => {
    const holidays = holidaysToSet([]);
    const date = localDate(2026, 4, 20);

    expect(countBusinessDays(date, date, holidays)).toBe(1);
  });
});
