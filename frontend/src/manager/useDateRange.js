import { useState } from 'react';
import { daysAgo, isoDate } from '../format';

export const DEFAULT_RANGE_DAYS = 30;

/** Range state for a report: { from, to, preset } as YYYY-MM-DD strings. */
export function useDateRange() {
  return useState({ from: isoDate(daysAgo(DEFAULT_RANGE_DAYS)), to: isoDate(), preset: 'Last 30 days' });
}
