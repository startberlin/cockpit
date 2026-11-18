import assert from "node:assert/strict";
import test from "node:test";
import {
  JOBBOARD_SUBMISSION_EMAIL_TYPE,
  shouldCaptureEmailEngagement,
} from "./email-engagement";

test("personal Jobboard submissions never enter Open or Click analytics", () => {
  for (const type of ["Open", "Click"]) {
    for (const environment of [undefined, ["production"], ["staging"]]) {
      assert.equal(
        shouldCaptureEmailEngagement(type, {
          environment,
          emailType: ["another-tag", JOBBOARD_SUBMISSION_EMAIL_TYPE],
        }),
        false,
      );
    }
  }
});

test("existing mail types keep their production analytics and operational events stay outside", () => {
  for (const type of ["Open", "Click"]) {
    assert.equal(
      shouldCaptureEmailEngagement(type, {
        environment: ["production"],
        emailType: ["welcome"],
      }),
      true,
    );
    assert.equal(shouldCaptureEmailEngagement(type), true);
    assert.equal(
      shouldCaptureEmailEngagement(type, {
        environment: ["staging"],
        emailType: ["welcome"],
      }),
      false,
    );
  }
  for (const type of ["Send", "Delivery", "Bounce", "Complaint", "Reject"]) {
    assert.equal(
      shouldCaptureEmailEngagement(type, {
        emailType: [JOBBOARD_SUBMISSION_EMAIL_TYPE],
      }),
      false,
    );
    assert.equal(
      shouldCaptureEmailEngagement(type, { emailType: ["welcome"] }),
      false,
    );
  }
});
