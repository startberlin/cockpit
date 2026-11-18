import assert from "node:assert/strict";
import test from "node:test";
import { SESv2ServiceException } from "@aws-sdk/client-sesv2";
import type {
  JobboardEmailClaim,
  JobboardEmailOutcome,
} from "../db/email-queue";
import { drainSubmissionEmailQueue } from "./submission-email-delivery";

const claim: JobboardEmailClaim = {
  token: "test-claim",
  userId: "usr_test",
  submissionId: "jbs_test",
  email: "member@example.org",
  jobTitle: "Test role",
  companyName: "Test company",
};
function fixture(
  jobs: (JobboardEmailClaim | "uncertain" | "skipped")[] = [claim],
  retryState: "pending" | "exhausted" | "stale" = "pending",
) {
  const outcomes: JobboardEmailOutcome[] = [];
  const retries: number[] = [];
  return {
    outcomes,
    retries,
    queue: {
      claimNext: async () => jobs.shift() ?? null,
      finish: async (
        _claim: JobboardEmailClaim,
        outcome: JobboardEmailOutcome,
      ) => {
        outcomes.push(outcome);
        return true;
      },
      retry: async (_claim: JobboardEmailClaim, delay: number) => {
        retries.push(delay);
        return retryState;
      },
    },
  };
}
function sesFailure(status: number) {
  return new SESv2ServiceException({
    name: "ProviderResponse",
    $fault: "server",
    $metadata: { httpStatusCode: status },
  });
}

test("records only aggregates in the workflow and handles disabled or empty queues", async () => {
  for (const ending of ["accepted", "disabled"] as const) {
    const { queue, outcomes } = fixture();
    const result = await drainSubmissionEmailQueue(queue, async (job) => {
      assert.deepEqual(job, claim);
      return ending;
    });
    assert.deepEqual(outcomes, [ending]);
    assert.equal(result[ending], 1);
    assert.ok(Object.values(result).every((v) => typeof v === "number"));
    const next = await drainSubmissionEmailQueue(queue, async () =>
      assert.fail("Nothing to send"),
    );
    assert.equal(next.accepted, 0);
  }
});

test("only an explicit SES throttle is retried, without immediately sending the next mail", async () => {
  const { queue, retries, outcomes } = fixture([
    claim,
    { ...claim, token: "second" },
  ]);
  const result = await drainSubmissionEmailQueue(queue, async () => {
    throw sesFailure(429);
  });
  assert.deepEqual(retries, [60]);
  assert.deepEqual(outcomes, []);
  assert.equal(result.throttled, 1);
  assert.deepEqual(await queue.claimNext(), { ...claim, token: "second" });
});

test("reports expired claims as terminal uncertainty without resending them", async () => {
  const { queue, retries, outcomes } = fixture(["uncertain", "skipped"]);
  const result = await drainSubmissionEmailQueue(queue, async () =>
    assert.fail("Terminal rows must not reach the provider"),
  );
  assert.equal(result.uncertain, 1);
  assert.equal(result.skipped, 1);
  assert.equal(result.accepted, 0);
  assert.deepEqual(retries, []);
  assert.deepEqual(outcomes, []);
});

test("reports final 429 exhaustion separately from rescheduling and stale ownership", async () => {
  for (const state of ["exhausted", "stale"] as const) {
    const { queue } = fixture([claim], state);
    const result = await drainSubmissionEmailQueue(queue, async () => {
      throw sesFailure(429);
    });
    assert.equal(result[state], 1);
    assert.equal(result.throttled, 0);
    assert.equal(result.uncertain, 0);
  }
});

test("records provider rejections and ambiguous outcomes without a second provider request", async () => {
  for (const [error, ending] of [
    [sesFailure(400), "rejected"],
    [sesFailure(408), "uncertain"],
    [sesFailure(503), "uncertain"],
    [new Error("connection lost"), "uncertain"],
  ] as const) {
    const { queue, outcomes, retries } = fixture();
    let attempts = 0;
    await drainSubmissionEmailQueue(queue, async () => {
      attempts++;
      throw error;
    });
    assert.equal(attempts, 1);
    assert.deepEqual(outcomes, [ending]);
    assert.deepEqual(retries, []);
  }
});

test("a failed receipt write after SES acknowledgement never triggers a retry in the sender", async () => {
  const { queue, retries } = fixture();
  let attempts = 0;
  queue.finish = async () => {
    throw new Error("DB offline");
  };
  await assert.rejects(
    drainSubmissionEmailQueue(queue, async () => {
      attempts++;
      return "accepted";
    }),
    /DB offline/,
  );
  assert.equal(attempts, 1);
  assert.deepEqual(retries, []);
});
