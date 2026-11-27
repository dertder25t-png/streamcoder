import { Weekday } from 'date-fns';

export function expandWeekdaySpec(spec: string): Weekday[] {
  if (!spec) {
    throw new Error('Empty spec provided');
  }

  const tokens = spec.split(',');
  const weekdays: Set<Weekday> = new Set();

  tokens.forEach(token => {
    const parts = token.split('-');
    if (parts.length !== 2) {
      throw new Error(`Malformed range: ${token}`);
    }

    const [start, end] = parts.map(part => part.trim().toLowerCase());
    if (!['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(start) || !['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].includes(end)) {
      throw new Error(`Unknown token: ${token}`);
    }

    const startDay = new Date().setHours(0, 0, 0, 0);
    const endDay = new Date().setHours(0, 0, 0, 0);

    const startDate = new Date(startDay).setDate(startDay.getDate() + ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(start));
    const endDate = new Date(endDay).setDate(endDay.getDate() + ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(end));

    if (startDate <= endDate) {
      for (let date = startDate; date <= endDate; date = new Date(date).setDate(date.getDate() + 1)) {
        weekdays.add(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][date.getDay()]);
      }
    } else {
      for (let date = startDate; date <= new Date(endDay).setDate(endDay.getDate() + 7); date = new Date(date).setDate(date.getDate() + 1)) {
        weekdays.add(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][date.getDay()]);
      }
    }
  });

  return Array.from(weekdays).sort((a, b) => ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(a) - ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].indexOf(b));
}
