import { Weekday } from 'date-fns';

const dayNames = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
type Weekday = typeof dayNames[number];

function expandWeekdaySpec(spec: string): Weekday[] {
  if (!spec) throw new Error('Empty spec provided');
  const tokens = spec.split(',');
  const result: Weekday[] = [];

  tokens.forEach(token => {
    const [start, end] = token.split('-').map(t => t.toLowerCase());
    if (start.length !== 3 || end.length !== 3 || !dayNames.includes(start as Weekday) || !dayNames.includes(end as Weekday)) {
      throw new Error(`Unknown token or malformed range: ${token}`);
    }

    const startIndex = dayNames.indexOf(start as Weekday);
    const endIndex = dayNames.indexOf(end as Weekday);

    if (startIndex <= endIndex) {
      // Normal range
      for (let i = startIndex; i <= endIndex; i++) {
        result.push(dayNames[i]);
      }
    } else {
      // Wrap-around range
      for (let i = startIndex; i < dayNames.length; i++) {
        result.push(dayNames[i]);
      }
      for (let i = 0; i <= endIndex; i++) {
        result.push(dayNames[i]);
      }
    }
  });

  return [...new Set(result)].sort((a, b) => dayNames.indexOf(a) - dayNames.indexOf(b)) as Weekday[];
}

export { expandWeekdaySpec };
