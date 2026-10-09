import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldInitializeReferralCampaign } from "./setup";

describe("automatic referral campaign setup", () => {
  const productionCron = {
    eventName: "inngest/scheduled.timer",
    environment: "production",
    cockpitUrl: "https://cockpit.start-berlin.com",
  };

  it("initializes only the production cron on the canonical HTTPS origin", () => {
    assert.equal(shouldInitializeReferralCampaign(productionCron), true);
    assert.equal(
      shouldInitializeReferralCampaign({
        ...productionCron,
        cockpitUrl: `${productionCron.cockpitUrl}/`,
      }),
      true,
    );
    for (const environment of [undefined, "development", "preview"])
      assert.equal(
        shouldInitializeReferralCampaign({ ...productionCron, environment }),
        false,
      );
    for (const cockpitUrl of [
      "http://localhost:3000",
      "https://staging.cockpit.start-berlin.com",
      "https://cockpit-preview.vercel.app",
      "http://cockpit.start-berlin.com",
      "https://cockpit.start-berlin.com:8443",
      "https://cockpit.start-berlin.com.example.test",
      "https://user@cockpit.start-berlin.com",
      "invalid-url",
    ])
      assert.equal(
        shouldInitializeReferralCampaign({ ...productionCron, cockpitUrl }),
        false,
      );
  });

  it("keeps business user events and generic invocation out of live setup", () => {
    for (const eventName of [
      "cockpit/user.updated",
      "cockpit/user.system-groups-sync",
      "inngest/function.invoked",
    ])
      assert.equal(
        shouldInitializeReferralCampaign({ ...productionCron, eventName }),
        false,
      );
  });
});
