import { z } from "zod";

export const PRESENCE_HEARTBEAT_MS = 10_000;
export const PRESENCE_TTL_MS = 45_000;
export const PRESENCE_CHANGE_WINDOW_MS = 20_000;

export interface EditorPresence {
  userId: string;
  name: string;
  isChanging: boolean;
  sessionCount: number;
}

export type IssuePresenceStatus = "idle" | "checking" | "ready" | "error";

export interface IssuePresenceSnapshot {
  editors: EditorPresence[];
  checkedAt: string | null;
  status: IssuePresenceStatus;
}

const presenceResponseSchema = z.object({
  editors: z.array(
    z.object({
      userId: z.string().min(1),
      name: z.string(),
      isChanging: z.boolean(),
      sessionCount: z.number().int().positive(),
    }),
  ),
  checkedAt: z.iso.datetime({ offset: true }),
});

export function parseIssuePresenceResponse(value: unknown) {
  return presenceResponseSchema.parse(value);
}

/** A departure owns only the registration from its visible activation. */
export function createPresenceSessionIdentity(
  createId: () => string = () => crypto.randomUUID(),
) {
  let currentId: string | null = null;
  return {
    activate(): string {
      currentId = createId();
      return currentId;
    },
    current(): string | null {
      return currentId;
    },
    release(): string | null {
      const departedId = currentId;
      currentId = null;
      return departedId;
    },
  };
}

/** Presence describes recent edits, including edits already saved. */
export function createIssuePresenceActivity(initialDraft: string) {
  let latestDraft = initialDraft;
  let changedAt: number | null = null;

  return {
    observe(draft: string, now: number): void {
      if (draft === latestDraft) return;
      latestDraft = draft;
      changedAt = now;
    },
    reset(draft: string): void {
      latestDraft = draft;
      changedAt = null;
    },
    isChanging(now: number): boolean {
      return (
        changedAt !== null &&
        now >= changedAt &&
        now - changedAt < PRESENCE_CHANGE_WINDOW_MS
      );
    },
  };
}

export function presenceEditorLabel(
  editor: EditorPresence,
  currentUserId: string,
): string {
  if (editor.userId === currentUserId)
    return editor.sessionCount === 1
      ? "You in another tab"
      : `You in ${editor.sessionCount} other tabs`;

  const name = editor.name.trim() || "Another editor";
  return editor.sessionCount === 1
    ? name
    : `${name} in ${editor.sessionCount} tabs`;
}
