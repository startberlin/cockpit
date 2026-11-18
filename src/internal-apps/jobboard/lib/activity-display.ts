const berlinTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
});

export function formatActivityTime(date: Date) {
  return berlinTime.format(date);
}

function formatStoredInstant(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? formatActivityTime(date) : value;
}

export function formatActivityDescription(
  eventType: string,
  description: string,
) {
  // These prefixes are written by the job service. Keep the audit record and
  // any free-text review notes verbatim.
  if (eventType === "job.expiry_updated") {
    return description.replace(
      /^Changed expiry from (\S+Z) to (\S+Z)\.$/,
      (_, from: string, to: string) =>
        `Changed expiry from ${formatStoredInstant(from)} to ${formatStoredInstant(to)}.`,
    );
  }
  if (eventType === "job.published") {
    return description.replace(
      /^Approved a public version until (\S+Z)\./,
      (_, until: string) =>
        `Approved a public version until ${formatStoredInstant(until)}.`,
    );
  }
  return description;
}
