export const REMINDER_TOTAL_DAYS = 90;
export const REMINDER_INTERVAL_DAYS = 3;

// Sends immediately, then waits for `terminateOn.eventName` on a recurring
// cadence until `timeoutDays` elapse. Returns the event payload on success or
// null on timeout.
//
// `send` receives the call index: 0 = first send, 1 = first reminder, etc.
// Callers use `index > 0` to set `isReminder`.
//
// `terminateOn.match` is a field name that generates the CEL expression
// `async.data.{match} == event.data.{match}` used in waitForEvent.
//
// Step IDs: `send-${id}-0d`, `wait-${id}-${n}d`, `send-${id}-${n}d`.
//
// The step parameter is typed as `any` because Inngest's actual step type wraps
// results in `Jsonify<T>` which conflicts with a concrete duck-typed interface.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function notifyUntil(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  step: any,
  opts: {
    id: string;
    terminateOn: {
      eventName: string;
      match: string;
    };
    timeoutDays: number;
    remindEveryDays: number;
    send: (index: number) => Promise<void>;
  },
): Promise<unknown> {
  if (opts.timeoutDays <= 0 || opts.remindEveryDays <= 0) {
    throw new Error(
      `notifyUntil: timeoutDays and remindEveryDays must be positive (got ${opts.timeoutDays}, ${opts.remindEveryDays})`,
    );
  }

  const eventIf = `async.data.${opts.terminateOn.match} == event.data.${opts.terminateOn.match}`;
  let elapsed = 0;
  let sendIndex = 0;

  await step.run(`send-${opts.id}-0d`, () => opts.send(sendIndex));
  sendIndex += 1;

  while (elapsed < opts.timeoutDays) {
    const wait = Math.min(opts.remindEveryDays, opts.timeoutDays - elapsed);
    const ev = await step.waitForEvent(`wait-${opts.id}-${elapsed}d`, {
      event: opts.terminateOn.eventName,
      timeout: `${wait}d`,
      if: eventIf,
    });

    if (ev !== null) return ev;

    elapsed += wait;

    if (elapsed < opts.timeoutDays) {
      const i = sendIndex;
      sendIndex += 1;
      await step.run(`send-${opts.id}-${elapsed}d`, () => opts.send(i));
    }
  }

  return null;
}
