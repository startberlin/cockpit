import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getMembershipProposalBlockReason } from "./membership-proposal";

describe("membership proposal eligibility", () => {
  it("allows a first proposal when there is no existing tenure", () => {
    assert.equal(getMembershipProposalBlockReason(null), null);
  });

  it("allows retrying an admission whose workflow has not started", () => {
    assert.equal(
      getMembershipProposalBlockReason({
        status: "admission_pending",
        inngestRunId: null,
      }),
      null,
    );
  });

  it("blocks an admission whose workflow has already started", () => {
    assert.match(
      getMembershipProposalBlockReason({
        status: "admission_pending",
        inngestRunId: "run_123",
      }) ?? "",
      /board admission vote is already in progress/,
    );
  });

  it("explains the applicant's next step after board approval", () => {
    for (const inngestRunId of [null, "run_123"]) {
      assert.match(
        getMembershipProposalBlockReason({
          status: "application_pending",
          inngestRunId,
        }) ?? "",
        /submit their membership application in My membership/,
      );
    }
  });

  it("blocks all other live tenures, including those without a workflow ID", () => {
    for (const status of [
      "membership_reconfirmation_pending",
      "processing",
      "active",
    ] as const) {
      for (const inngestRunId of [null, "run_123"]) {
        assert.ok(getMembershipProposalBlockReason({ status, inngestRunId }));
      }
    }
  });

  it("allows a new proposal after cancellation or manual follow-up", () => {
    for (const status of ["cancelled", "manual_followup"] as const) {
      assert.equal(
        getMembershipProposalBlockReason({ status, inngestRunId: "run_123" }),
        null,
      );
    }
  });
});
