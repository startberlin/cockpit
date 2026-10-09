import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldInitializeReferralCampaign } from "./setup";

describe("referral campaign activation", () => {
  const productionCron = {
    eventName: "inngest/scheduled.timer",
    environment: "production",
    cockpitUrl: "https://cockpit.start-berlin.com",
  };

  it("allows cron and internal invocation only in production on the canonical HTTPS origin", () => {
    for (const eventName of [
      "inngest/scheduled.timer",
      "inngest/function.invoked",
    ]) {
      const activation = { ...productionCron, eventName };
      assert.equal(shouldInitializeReferralCampaign(activation), true);
      assert.equal(
        shouldInitializeReferralCampaign({
          ...activation,
          cockpitUrl: `${activation.cockpitUrl}/`,
        }),
        true,
      );
      for (const environment of [undefined, "development", "preview"])
        assert.equal(
          shouldInitializeReferralCampaign({ ...activation, environment }),
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
          shouldInitializeReferralCampaign({ ...activation, cockpitUrl }),
          false,
        );
    }
  });

  it("keeps business user events out of live setup", () => {
    for (const eventName of [
      "cockpit/user.updated",
      "cockpit/user.system-groups-sync",
      "user.created",
    ])
      assert.equal(
        shouldInitializeReferralCampaign({ ...productionCron, eventName }),
        false,
      );
  });
});
