"use client";

import { AlertTriangle, Loader2, Pencil, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  type IssuePresenceSnapshot,
  presenceEditorLabel,
} from "../lib/issue-presence";

interface IssuePresenceNoticeProps extends IssuePresenceSnapshot {
  currentUserId: string;
  className?: string;
}

export function IssuePresenceNotice({
  editors,
  checkedAt,
  status,
  currentUserId,
  className,
}: IssuePresenceNoticeProps) {
  if (status === "idle" || (status === "ready" && !editors.length)) return null;

  if (status === "checking")
    return (
      <Alert className={className} role="status" aria-live="polite">
        <Loader2 className="animate-spin" />
        <AlertTitle>Checking other editors</AlertTitle>
        <AlertDescription>
          Checking who else has this draft open.
        </AlertDescription>
      </Alert>
    );

  const labels = (entries: typeof editors) =>
    entries
      .map((editor) => presenceEditorLabel(editor, currentUserId))
      .join(", ");

  if (status === "error")
    return (
      <Alert className={className} role="status" aria-live="polite">
        <AlertTriangle />
        <AlertTitle>Other editors could not be checked</AlertTitle>
        <AlertDescription>
          <p>
            The editing warning is temporarily unavailable. Saving still checks
            for draft conflicts.
          </p>
          {editors.length ? (
            <p>
              Last seen
              {checkedAt ? (
                <>
                  {" "}
                  at{" "}
                  <time dateTime={checkedAt}>
                    {new Date(checkedAt).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </>
              ) : null}
              : {labels(editors)}.
            </p>
          ) : null}
        </AlertDescription>
      </Alert>
    );

  const changing = editors.filter((editor) => editor.isChanging);
  const open = editors.filter((editor) => !editor.isChanging);
  const anotherPerson = editors.some(
    (editor) => editor.userId !== currentUserId,
  );
  let title = "This draft is open in another tab";
  if (changing.length) {
    title = changing.some((editor) => editor.userId !== currentUserId)
      ? "Another editor is making changes"
      : "Your other tab is making changes";
  } else if (anotherPerson) {
    title = "Someone else has this draft open";
  }
  return (
    <Alert className={className} role="status" aria-live="polite">
      {changing.length ? <Pencil /> : <Users />}
      <AlertTitle className="line-clamp-none">{title}</AlertTitle>
      <AlertDescription>
        {changing.length ? <p>Making changes: {labels(changing)}.</p> : null}
        {open.length ? <p>Also open with: {labels(open)}.</p> : null}
        <p>
          {anotherPerson
            ? "Coordinate edits so only one person changes the draft at a time."
            : "Use one tab to edit this draft."}
        </p>
      </AlertDescription>
    </Alert>
  );
}
