import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatPercent, formatRelative } from "./format";

describe("newsletter date formatting", () => {
  it("includes the year when Berlin has entered a new year before UTC", () => {
    assert.equal(
      formatRelative(
        new Date("2026-01-01T12:00:00Z"),
        new Date("2026-12-31T23:30:00Z"),
      ),
      "1 Jan 2026",
    );
  });

  it("omits the year when both dates are in the same Berlin calendar year", () => {
    assert.equal(
      formatRelative(
        new Date("2026-12-31T23:30:00Z"),
        new Date("2027-01-20T12:00:00Z"),
      ),
      "1 Jan",
    );
  });

  it("distinguishes unavailable rates from a measured zero", () => {
    assert.equal(formatPercent(null), "-");
    assert.equal(formatPercent(0), "0.0%");
  });
});
