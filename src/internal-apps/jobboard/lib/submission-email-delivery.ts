import { SESv2ServiceException } from "@aws-sdk/client-sesv2";
import type {
  createJobboardEmailQueue,
  JobboardEmailClaim,
} from "../db/email-queue";

type Queue = ReturnType<typeof createJobboardEmailQueue>;
type Send = (claim: JobboardEmailClaim) => Promise<"accepted" | "disabled">;

function providerFailure(error: unknown) {
  const status =
    error instanceof SESv2ServiceException
      ? error.$metadata.httpStatusCode
      : undefined;
  if (status === 429) return "throttled";
  if (status && status >= 400 && status < 500 && status !== 408)
    return "rejected";
  return "uncertain";
}

/** The claim is durable before SES is called. Never retry a timeout or an ambiguous acknowledgement. */
export async function drainSubmissionEmailQueue(queue: Queue, send: Send) {
  const totals = {
    accepted: 0,
    disabled: 0,
    rejected: 0,
    skipped: 0,
    uncertain: 0,
    throttled: 0,
    exhausted: 0,
    stale: 0,
  };
  const deadline = Date.now() + 45_000;
  for (
    let processed = 0;
    processed < 30 && Date.now() < deadline;
    processed++
  ) {
    const claim = await queue.claimNext();
    if (!claim) break;
    if (typeof claim === "string") {
      // The database already persisted a terminal outcome (for example, an
      // expired sending claim). There is no new provider request to make.
      totals[claim]++;
      continue;
    }
    let outcome: Awaited<ReturnType<Send>> | ReturnType<typeof providerFailure>;
    try {
      outcome = await send(claim);
    } catch (error) {
      outcome = providerFailure(error);
    }
    if (outcome === "throttled") {
      const state = await queue.retry(claim, 60);
      totals[state === "pending" ? "throttled" : state]++;
      break;
    }
    const recorded = await queue.finish(claim, outcome);
    totals[recorded ? outcome : "stale"]++;
  }
  return totals;
}
