/**
 * Date formatting shared by the issue list and reports.
 *
 * All absolute times are rendered in Europe/Berlin explicitly. These are
 * server components, so an implicit timezone would silently be the host's — and
 * "sent at 09:00" meaning something different depending on where the container
 * runs is the kind of bug nobody notices until it matters.
 */

export const BERLIN = "Europe/Berlin";
const countFormat = new Intl.NumberFormat("en-GB");
const yearFormat = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  timeZone: BERLIN,
});

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: BERLIN,
});

const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: BERLIN,
});

const withYear = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: BERLIN,
});

export function formatDateTime(date: Date): string {
  return dateTime.format(date);
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "3 hours ago", "in 2 days", "12 Oct".
 *
 * Relative wording only inside a week: past that it stops being easier to read
 * than a date. Pair with the absolute time in a `title` so the exact value is
 * always one hover away.
 */
export function formatRelative(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const future = diff > 0;

  if (abs < MINUTE) return "just now";

  if (abs < HOUR) {
    const n = Math.round(abs / MINUTE);
    return future ? `in ${n} min` : `${n} min ago`;
  }

  if (abs < DAY) {
    const n = Math.round(abs / HOUR);
    return future
      ? `in ${n} hour${n === 1 ? "" : "s"}`
      : `${n} hour${n === 1 ? "" : "s"} ago`;
  }

  if (abs < 7 * DAY) {
    const n = Math.round(abs / DAY);
    return future
      ? `in ${n} day${n === 1 ? "" : "s"}`
      : `${n} day${n === 1 ? "" : "s"} ago`;
  }

  const sameYear = yearFormat.format(date) === yearFormat.format(now);
  return (sameYear ? dayMonth : withYear).format(date);
}

/** `1234` → `1,234`. Keeps wide numbers readable in a table. */
export function formatCount(value: number): string {
  return countFormat.format(value);
}

export function formatPercent(value: number | null): string {
  return value === null ? "-" : `${value.toFixed(1)}%`;
}
