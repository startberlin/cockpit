import assert from "node:assert/strict";
import { it } from "node:test";
import { render } from "react-email";

process.env.NEXT_PUBLIC_COCKPIT_URL ??= "https://cockpit.example.com";
const { ParticipationChangeEmail } = await import("./participation-change");

const props = {
  recipientName: "Alex",
  effectiveDate: "17 Nov 2026",
  cockpitUrl: "https://cockpit.example.com/membership",
};

it("reminds a paused member that dues and email access continue", async () => {
  const text = await render(<ParticipationChangeEmail {...props} paused />, {
    plainText: true,
  });
  assert.match(text, /Your participation at START Berlin is paused/i);
  assert.match(text, /Your membership dues continue as usual/i);
  assert.match(text, /START account, email and Cockpit/i);
  assert.match(text, /17 Nov 2026/);
});

it("sends department leads a separate participation update", async () => {
  const text = await render(
    <ParticipationChangeEmail
      {...props}
      memberName="Jamie Example"
      paused={false}
    />,
    { plainText: true },
  );
  assert.match(text, /Jamie Example's participation is resumed/i);
  assert.match(text, /Open people directory/i);
  assert.doesNotMatch(text, /membership dues/i);
});
