// Is the US stock market open? Regular hours, 9:30–16:00 New York time on weekdays. Holidays
// are not known here: on one the bar says "open" while every quote sits still.
export interface MarketState {
  open: boolean;
  /** Minutes until it closes (open) or next opens (closed). */
  minutes: number;
}

function nyParts(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "numeric", hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: get("weekday"), minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

const OPEN = 9 * 60 + 30, CLOSE = 16 * 60;
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function usMarket(now = new Date()): MarketState {
  const { day, minute } = nyParts(now);
  const dow = DAYS.indexOf(day);
  const weekday = dow >= 1 && dow <= 5;
  if (weekday && minute >= OPEN && minute < CLOSE) return { open: true, minutes: CLOSE - minute };
  // Days until the next weekday open.
  let days = 0;
  if (!(weekday && minute < OPEN)) {
    days = 1;
    while (((dow + days) % 7 === 0) || ((dow + days) % 7 === 6)) days++;
  }
  return { open: false, minutes: days * 1440 + OPEN - minute };
}

export function span(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}
