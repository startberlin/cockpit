import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { IssuePresenceSnapshot } from "../lib/issue-presence";
import { IssuePresenceNotice } from "./issue-presence-notice";

function renderNotice(snapshot: Partial<IssuePresenceSnapshot>): string {
  return renderToStaticMarkup(
    createElement(IssuePresenceNotice, {
      currentUserId: "current-user",
      editors: [],
      checkedAt: "2026-09-29T12:00:00Z",
      status: "ready",
      ...snapshot,
    }),
  );
}

describe("issue presence warning", () => {
  it("does not warn after a successful check finds no peers or when disabled", () => {
    assert.equal(renderNotice({}), "");
    assert.equal(renderNotice({ status: "idle" }), "");
  });

  it("announces another person's recent changes and identifies that person", () => {
    const html = renderNotice({
      editors: [
        {
          userId: "another-user",
          name: "Vicky",
          isChanging: true,
          sessionCount: 1,
        },
      ],
    });
    assert.match(html, /Another editor is making changes/);
    assert.match(html, /Making changes: Vicky/);
    assert.match(html, /Coordinate edits/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
  });

  it("describes this user's other tabs without implying a different person", () => {
    const html = renderNotice({
      editors: [
        {
          userId: "current-user",
          name: "Jannik",
          isChanging: true,
          sessionCount: 2,
        },
      ],
    });
    assert.match(html, /Your other tab is making changes/);
    assert.match(html, /You in 2 other tabs/);
    assert.match(html, /Use one tab to edit this draft/);
    assert.doesNotMatch(html, /Another editor is making changes/);
  });

  it("distinguishes an open draft from recent changes", () => {
    const html = renderNotice({
      editors: [
        {
          userId: "another-user",
          name: "Vicky",
          isChanging: false,
          sessionCount: 1,
        },
      ],
    });
    assert.match(html, /Someone else has this draft open/);
    assert.match(html, /Also open with: Vicky/);
    assert.doesNotMatch(html, /Making changes:/);
  });

  it("labels old names as last seen after a failed check", () => {
    const html = renderNotice({
      status: "error",
      editors: [
        {
          userId: "another-user",
          name: "Vicky",
          isChanging: true,
          sessionCount: 1,
        },
      ],
    });
    assert.match(html, /Other editors could not be checked/);
    assert.match(html, /Last seen/);
    assert.match(html, /dateTime="2026-09-29T12:00:00Z"/);
    assert.match(html, /Vicky/);
    assert.doesNotMatch(html, /Making changes:/);
    assert.notEqual(renderNotice({ status: "error" }), "");
  });
});
