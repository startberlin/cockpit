---
date: 2026-05-09
topic: people-directory-unified-view
---

# People Directory: Unified View with Inline Action Indicators

## Summary

Replace the two-tab People page (Action required / Directory) with a single unified directory view. Users who have pending board votes float to the top with an inline Vote button; users with nothing to vote on — including all regular members — see a plain directory with no action chrome.

---

## Problem Frame

The People page currently splits its content across two tabs: "Action required" (a list of board vote cards) and "Directory" (the full member table). This creates two problems:

1. **Irrelevant UI for non-board members.** Regular members who can never cast an admission vote still see the "Action required" tab. They land on an empty "You're all caught up" state every time, or on the Directory if no actions exist. The tab is noise for them.

2. **Context switch for board members.** A board member who opens People to look someone up must switch tabs to vote, then switch back. The two views are related — the subject of the vote exists in the directory — but the tab model treats them as separate contexts.

---

## Requirements

**View structure**

- R1. The tab bar (Action required / Directory) is removed entirely.
- R2. The People page renders a single view: the full member directory table.

**Pending action indicators**

- R3. If the current user has one or more pending board votes, the subjects of those votes are sorted to the top of the directory.
- R4. A visual separator distinguishes the "vote needed" group from the rest of the directory.
- R5. Each vote-needed row displays an inline "Vote" button that links to the board resolution page for that person.
- R6. The pending-action badge/count that currently appears on the "Action required" tab trigger is removed along with the tab.

**Zero-action state**

- R7. When the current user has zero pending board votes, the directory renders with no action chrome: no separator, no Vote buttons, no action-related empty state.
- R8. The "You're all caught up" message is removed.

---

## Acceptance Examples

- AE1. **Covers R3, R4, R5.** Given a board member with two pending admission votes (for Ana Müller and Jan Koch), when they open the People page, Ana and Jan appear at the top of the directory above a divider, each with a "Vote" button in their row. All other members appear below the divider without Vote buttons.

- AE2. **Covers R7, R8.** Given a regular member (who is never an admission participant), when they open the People page, they see the directory with no separator, no Vote buttons, and no action-related messaging.

- AE3. **Covers R7, R8.** Given a board member who has already voted on all open resolutions, when they open the People page, they see the same plain directory as a regular member — no action chrome.

---

## Success Criteria

- A regular member opening the People page sees only the directory — no tab, no empty "Action required" state.
- A board member with pending votes can identify and act on them without leaving the directory view.
- A board member who has voted on everything sees no residual action UI.

---

## Scope Boundaries

- No nav-level badge or notification count for pending votes outside the People page.
- No changes to how pending actions are fetched, who qualifies as an admission participant, or what constitutes a pending vote.
- No changes to the board resolution voting page (`/people/resolutions/[id]`).
- No filtering or search scoped specifically to the vote-needed group.

---

## Key Decisions

- **Single view over tabs:** tabs impose a context switch even when the two views are tightly related. Inline indicators in the directory keep the subject in view while exposing the action.
- **Sort-to-top over badge-only:** a badge alone requires the user to scan to find the subject; floating to the top removes that scan.
- **No empty-state message when all votes are cast:** the absence of Vote buttons is self-explanatory; a "You're all caught up" message adds noise for a state that most users are always in.

---

## Dependencies / Assumptions

- The existing `pendingActions` array (passed as a prop to the client component) already contains subject user IDs. Cross-referencing with the directory rows requires no additional data fetch.
- Sorting vote-needed users to the top only changes client-side row order — the underlying directory data query is unchanged.
