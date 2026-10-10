import "server-only";

import { z } from "zod";
import db from "@/db";
import { SYSTEM_USER_EMAIL } from "@/db/people";
import { batch } from "@/db/schema/batch";
import {
  getAllSystemGroups,
  getMembersOfSystemGroup,
} from "@/lib/groups/system-groups";
import { newsletterContact } from "../db/schema";

/**
 * Turns a Cockpit system group into a set of newsletter contacts.
 *
 * Reuses `system-groups.ts` rather than reimplementing "who counts as a
 * member": that logic already accounts for status, department leads, batches
 * and grants, and it is unit-tested.
 *
 * Address selection is deliberately limited to `email` and `personalEmail`.
 * `user.eventEmailPreference` and `user.eventInviteEmail` would be a better
 * signal of where someone wants non-transactional mail, but `src/db/schema/auth.ts`
 * declares those columns private to the membership domain. Reading them from
 * another app is exactly the case that comment warns against; if the newsletter
 * ever needs a per-person delivery preference, the right move is a shared
 * preference table, not a quiet cross-domain read.
 */

export interface ImportCandidate {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string | null;
  department: string | null;
  batchNumber: number | null;
}

export interface ImportPreview {
  groupSlug: string;
  groupName: string;
  /** Everyone the group resolves to. */
  memberCount: number;
  /** Members with no usable address at all. */
  withoutEmail: number;
  /** Already present in Resend, per the local mirror. */
  existing: number;
  /** Would be created. */
  fresh: number;
  candidates: ImportCandidate[];
}

export async function listImportGroups() {
  const batches = await db.select({ number: batch.number }).from(batch);
  return getAllSystemGroups(batches).map((group) => ({
    slug: group.slug,
    name: group.name,
  }));
}

async function resolveCandidates(groupSlug: string): Promise<{
  candidates: ImportCandidate[];
  memberCount: number;
  withoutEmail: number;
}> {
  const [userRows, positions] = await Promise.all([
    db.query.user.findMany({
      columns: {
        id: true,
        status: true,
        department: true,
        batchNumber: true,
        firstName: true,
        lastName: true,
        email: true,
        personalEmail: true,
      },
      with: { accessGrants: { columns: { grant: true } } },
    }),
    db.query.userOrganizationPosition.findMany({
      columns: { userId: true, position: true, scope: true, department: true },
    }),
  ]);

  const minimal = userRows.map((u) => ({
    id: u.id,
    status: u.status,
    department: u.department,
    batchNumber: u.batchNumber,
    grants: u.accessGrants.map((g) => g.grant),
  }));

  const memberIds = new Set(
    getMembersOfSystemGroup(groupSlug, minimal, positions).map((m) => m.id),
  );

  const members = userRows.filter((u) => memberIds.has(u.id));
  return { ...buildImportCandidates(members), memberCount: members.length };
}

/** Normalize usable addresses before they reach the bulk CSV importer. */
export function buildImportCandidates(
  members: {
    id: string;
    email: string | null;
    personalEmail: string | null;
    firstName: string;
    lastName: string;
    status: string | null;
    department: string | null;
    batchNumber: number | null;
  }[],
): { candidates: ImportCandidate[]; withoutEmail: number } {
  const candidates: ImportCandidate[] = [];
  const seen = new Set<string>();
  let withoutEmail = 0;
  for (const member of members) {
    if (member.email?.trim().toLowerCase() === SYSTEM_USER_EMAIL) continue;
    const email = [member.email, member.personalEmail]
      .map((address) => address?.trim().toLowerCase() ?? "")
      .find((address) => z.email().safeParse(address).success);
    if (!email || email === SYSTEM_USER_EMAIL) {
      withoutEmail++;
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    candidates.push({
      userId: member.id,
      email,
      firstName: member.firstName,
      lastName: member.lastName,
      status: member.status,
      department: member.department,
      batchNumber: member.batchNumber,
    });
  }
  return { candidates, withoutEmail };
}

export async function previewCockpitImport(
  groupSlug: string,
): Promise<ImportPreview> {
  const groups = await listImportGroups();
  const group = groups.find((g) => g.slug === groupSlug);
  if (!group) throw new Error(`Unknown group "${groupSlug}".`);

  const { candidates, memberCount, withoutEmail } =
    await resolveCandidates(groupSlug);

  const mirrored = await db
    .select({ email: newsletterContact.email })
    .from(newsletterContact);
  const known = new Set(mirrored.map((row) => row.email.toLowerCase()));

  const existing = candidates.filter((c) => known.has(c.email)).length;

  return {
    groupSlug,
    groupName: group.name,
    memberCount,
    withoutEmail,
    existing,
    fresh: candidates.length - existing,
    candidates,
  };
}

const FORMULA_CHARS = new Set(["=", "+", "-", "@", "\t", "\n", "\r"]);

/** Quotes a CSV field and defuses spreadsheet formula injection. */
function csvField(value: string): string {
  const safe = FORMULA_CHARS.has(value[0]) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

/**
 * Builds the CSV that Resend's bulk importer consumes.
 *
 * `source` records where every address came from. The kickoff notes are
 * explicit that the list has to rest on demonstrable opt-ins, and "which import
 * brought this person in, and when" is the part that is impossible to
 * reconstruct after the fact.
 */
export function buildImportCsv(
  candidates: ImportCandidate[],
  { groupSlug, importedAt }: { groupSlug: string; importedAt: string },
): string {
  const header = [
    "email",
    "first_name",
    "last_name",
    "source",
    "member_status",
    "department",
    "batch_number",
  ].join(",");

  const rows = candidates.map((c) =>
    [
      csvField(c.email),
      csvField(c.firstName),
      csvField(c.lastName),
      csvField(`cockpit:${groupSlug}:${importedAt}`),
      csvField(c.status ?? ""),
      csvField(c.department ?? ""),
      csvField(c.batchNumber === null ? "" : String(c.batchNumber)),
    ].join(","),
  );

  return [header, ...rows].join("\n");
}
