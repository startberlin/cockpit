import type { Department, UserStatus } from "@/db/schema/auth";
import type {
  AuthorityScope,
  OrganizationPosition,
} from "@/db/schema/authority";
import { DEPARTMENT_IDS, DEPARTMENT_NAMES } from "@/lib/departments";

// ─── Public types ──────────────────────────────────────────────────────────────

export type SystemGroupUser = {
  id: string;
  status: UserStatus | null;
  department: Department | null;
  batchNumber: number | null;
};

/** Per-user position shape — same as userOrganizationPosition columns (no userId). */
export type UserPosition = {
  position: OrganizationPosition;
  scope: AuthorityScope;
  department: Department | null;
};

/** Flat position row from DB queries that span multiple users. */
export type SystemGroupPositionRow = { userId: string } & UserPosition;

export type SystemGroup = {
  slug: string;
  name: string;
  googleEmailPrefix: string;
  googleGroupEmail: string;
};

// ─── Internal definition type ──────────────────────────────────────────────────

type SystemGroupDef = {
  slug: string;
  name: string;
  googleEmailPrefix: string;
  isMember: (user: SystemGroupUser, positions: UserPosition[]) => boolean;
};

const DOMAIN = "start-berlin.com";

/**
 * Returns the email prefix to prepend to all Google Group addresses for the
 * current environment. Keeps prod clean while isolating staging/dev groups.
 *
 * VERCEL_ENV === "production"  → "" (no prefix)
 * VERCEL_ENV === "preview"     → "staging-"
 * anything else / unset        → "dev-"
 */
export function getEnvEmailPrefix(): string {
  const vercelEnv = process.env.VERCEL_ENV;
  if (vercelEnv === "production") return "";
  if (vercelEnv === "preview") return "staging-";
  return "dev-";
}

function defToGroup(def: SystemGroupDef): SystemGroup {
  const envPrefix = getEnvEmailPrefix();
  const prefixedEmailPrefix = `${envPrefix}${def.googleEmailPrefix}`;
  return {
    slug: def.slug,
    name: def.name,
    googleEmailPrefix: prefixedEmailPrefix,
    googleGroupEmail: `${prefixedEmailPrefix}@${DOMAIN}`,
  };
}

// ─── Static group definitions ──────────────────────────────────────────────────

const STATIC_SYSTEM_GROUP_DEFS: SystemGroupDef[] = [
  {
    slug: "members",
    name: "Members",
    googleEmailPrefix: "members",
    isMember: (u) =>
      u.status === "onboarding" ||
      u.status === "member" ||
      u.status === "supporting_alumni",
  },
  {
    slug: "onboarding-members",
    name: "Onboarding Members",
    googleEmailPrefix: "onboarding-members",
    isMember: (u) => u.status === "onboarding",
  },
  {
    slug: "board",
    name: "Board",
    googleEmailPrefix: "board",
    isMember: (u, positions) =>
      u.status !== null &&
      u.status !== "cancelled" &&
      u.status !== "alumni" &&
      positions.length > 0,
  },
  {
    slug: "legal-board",
    name: "Legal Board",
    googleEmailPrefix: "legal-board",
    isMember: (u, positions) =>
      u.status !== null &&
      u.status !== "cancelled" &&
      u.status !== "alumni" &&
      positions.some(
        (p) =>
          p.position === "president" ||
          p.position === "vice_president" ||
          p.position === "head_of_finance",
      ),
  },
];

// ─── Per-department definitions (×2 per department) ───────────────────────────

const DEPT_SYSTEM_GROUP_DEFS: SystemGroupDef[] = DEPARTMENT_IDS.flatMap(
  (dept) => [
    {
      slug: dept,
      name: DEPARTMENT_NAMES[dept],
      googleEmailPrefix: dept,
      isMember: (u, positions) =>
        u.status !== null &&
        u.status !== "cancelled" &&
        u.status !== "alumni" &&
        positions.some(
          (p) => p.position === "department_head" && p.department === dept,
        ),
    },
    {
      slug: `${dept}-members`,
      name: `${DEPARTMENT_NAMES[dept]} Members`,
      googleEmailPrefix: `${dept}-members`,
      isMember: (u) =>
        u.department === dept &&
        u.status !== null &&
        u.status !== "cancelled" &&
        u.status !== "alumni" &&
        u.status !== "supporting_alumni",
    },
  ],
);

// ─── Per-batch definition ──────────────────────────────────────────────────────

function batchSystemGroupDef(batchNumber: number): SystemGroupDef {
  return {
    slug: `batch-${batchNumber}`,
    name: `Batch ${batchNumber}`,
    googleEmailPrefix: `batch-${batchNumber}`,
    isMember: (u) =>
      u.batchNumber === batchNumber &&
      u.status !== null &&
      u.status !== "cancelled" &&
      u.status !== "alumni",
  };
}

// ─── All defs (static + dept + batch) ─────────────────────────────────────────

function getAllDefs(batches: { number: number }[]): SystemGroupDef[] {
  return [
    ...STATIC_SYSTEM_GROUP_DEFS,
    ...DEPT_SYSTEM_GROUP_DEFS,
    ...batches.map((b) => batchSystemGroupDef(b.number)),
  ];
}

/** Find a def by slug without needing a batch list (parses batch-N from slug). */
function getDefBySlug(slug: string): SystemGroupDef | undefined {
  const staticOrDept = [
    ...STATIC_SYSTEM_GROUP_DEFS,
    ...DEPT_SYSTEM_GROUP_DEFS,
  ].find((d) => d.slug === slug);
  if (staticOrDept) return staticOrDept;

  const batchMatch = /^batch-(\d+)$/.exec(slug);
  if (batchMatch) return batchSystemGroupDef(Number(batchMatch[1]));

  return undefined;
}

// ─── Exported helpers ──────────────────────────────────────────────────────────

/** All slugs currently in use — used by the daily reconcile cron. */
export function getAllSystemGroupSlugs(
  batches: { number: number }[],
): string[] {
  return getAllDefs(batches).map((d) => d.slug);
}

/** All system group definitions with metadata — used by the admin list page. */
export function getAllSystemGroups(
  batches: { number: number }[],
): SystemGroup[] {
  return getAllDefs(batches).map(defToGroup);
}

/** Check if a slug belongs to a known system group (batch slugs validated against DB list). */
export function isSystemGroupSlug(
  slug: string,
  batches: { number: number }[],
): boolean {
  return getAllDefs(batches).some((d) => d.slug === slug);
}

/** Resolve a system group's metadata from its slug (batch groups without DB validation). */
export function getSystemGroupBySlug(slug: string): SystemGroup | undefined {
  const def = getDefBySlug(slug);
  return def ? defToGroup(def) : undefined;
}

/**
 * Returns the system groups a user currently belongs to.
 * Positions must be the user's own positions (no userId field needed).
 */
export function getSystemGroupsForUser(
  user: SystemGroupUser,
  positions: UserPosition[],
  batches: { number: number }[],
): SystemGroup[] {
  return getAllDefs(batches)
    .filter((d) => d.isMember(user, positions))
    .map(defToGroup);
}

/**
 * Returns all users who are members of a given system group slug.
 * Positions is the full flat array across all users; grouped internally by userId.
 * Works without a batch list by parsing batch-N slugs directly.
 */
export function getMembersOfSystemGroup<U extends SystemGroupUser>(
  slug: string,
  users: U[],
  positions: SystemGroupPositionRow[],
): U[] {
  const def = getDefBySlug(slug);
  if (!def) return [];

  const positionsByUser = new Map<string, UserPosition[]>();
  for (const p of positions) {
    const list = positionsByUser.get(p.userId) ?? [];
    list.push({
      position: p.position,
      scope: p.scope,
      department: p.department,
    });
    positionsByUser.set(p.userId, list);
  }

  return users.filter((u) => def.isMember(u, positionsByUser.get(u.id) ?? []));
}
