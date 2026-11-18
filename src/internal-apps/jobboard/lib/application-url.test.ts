import assert from "node:assert/strict";
import { it } from "node:test";
import { addJobboardUtmParameters } from "./application-url";

const base = "https://jobs.example.org/apply";
const tags =
  "utm_source=start_berlin&utm_medium=referral&utm_campaign=jobboard";

it("adds the Jobboard campaign once, before an existing fragment", () => {
  const tagged = `${base}?${tags}#apply`;
  assert.equal(addJobboardUtmParameters(`${base}#apply`), tagged);
  assert.equal(addJobboardUtmParameters(tagged), tagged);
});

it("preserves existing partner values, repeated keys and their exact encoding", () => {
  const ats = `${base}?ref=jobs%2Fboard%20DE&ref=~berlin&utm_source=PARTNER`;
  assert.equal(
    addJobboardUtmParameters(`${ats}#apply`),
    `${ats}&utm_medium=referral&utm_campaign=jobboard#apply`,
  );
});

it("handles an empty query and question marks inside a partner value", () => {
  assert.equal(addJobboardUtmParameters(`${base}?`), `${base}?${tags}`);
  assert.equal(
    addJobboardUtmParameters(`${base}?ref=a&`),
    `${base}?ref=a&${tags}`,
  );
  assert.equal(
    addJobboardUtmParameters(`${base}?ref=a?`),
    `${base}?ref=a?&${tags}`,
  );
});

it("only tags public web destinations within the API length limit", () => {
  for (const url of [
    "mailto:recruiting@example.org",
    "http://localhost/apply",
    "not a URL",
    base.padEnd(2048, "a"),
  ])
    assert.equal(addJobboardUtmParameters(url), null);
});
