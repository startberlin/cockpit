import type { GlobalOrganizationPosition, UserAuthority } from "./model";
import { globalOrganizationPositions } from "./model";

export type BoardRosterSetup =
  | {
      ok: true;
      legalOfficerIds: string[];
      officers: {
        presidentId: string;
        vicePresidentId: string;
        headOfFinanceId: string;
      };
    }
  | { ok: false; reason: "invalid_legal_officer_count"; count: number }
  | {
      ok: false;
      reason: "missing_officer_function";
      missing: Array<"president" | "vice_president" | "head_of_finance">;
    }
  | {
      ok: false;
      reason: "duplicate_officer_function";
      duplicate: Array<"president" | "vice_president" | "head_of_finance">;
    }
  | {
      ok: false;
      reason: "overlapping_officer_function";
      officerIds: string[];
    };

type OfficerPosition = "president" | "vice_president" | "head_of_finance";

const officerPositions = [
  "president",
  "vice_president",
  "head_of_finance",
] as const satisfies OfficerPosition[];

function hasGlobalAuthorityPosition(
  authority: UserAuthority,
  position: GlobalOrganizationPosition,
) {
  return authority.positions.some(
    (assignment) =>
      assignment.scope === "global" && assignment.position === position,
  );
}

function userIdsWithPosition(
  authorities: UserAuthority[],
  position: GlobalOrganizationPosition,
) {
  return authorities
    .filter((authority) => hasGlobalAuthorityPosition(authority, position))
    .map((authority) => authority.userId);
}

export function getBoardRosterSetup(
  authorities: UserAuthority[],
): BoardRosterSetup {
  const boardMembers = authorities.filter((authority) =>
    authority.positions.some(
      (assignment) =>
        assignment.scope === "global" &&
        globalOrganizationPositions.includes(assignment.position),
    ),
  );
  const legalOfficerIds = [
    ...new Set(boardMembers.map(({ userId }) => userId)),
  ];
  const officerUserIds = Object.fromEntries(
    officerPositions.map((position) => [
      position,
      userIdsWithPosition(boardMembers, position),
    ]),
  ) as Record<OfficerPosition, string[]>;
  const missing = officerPositions.filter(
    (position) => officerUserIds[position].length === 0,
  );

  if (missing.length > 0) {
    return { ok: false, reason: "missing_officer_function", missing };
  }

  const duplicate = officerPositions.filter(
    (position) => officerUserIds[position].length > 1,
  );

  if (duplicate.length > 0) {
    return { ok: false, reason: "duplicate_officer_function", duplicate };
  }

  const presidentId = officerUserIds.president[0];
  const vicePresidentId = officerUserIds.vice_president[0];
  const headOfFinanceId = officerUserIds.head_of_finance[0];
  const officerIds = [presidentId, vicePresidentId, headOfFinanceId];

  if (new Set(officerIds).size !== officerIds.length) {
    return {
      ok: false,
      reason: "overlapping_officer_function",
      officerIds,
    };
  }

  if (legalOfficerIds.length !== 3) {
    return {
      ok: false,
      reason: "invalid_legal_officer_count",
      count: legalOfficerIds.length,
    };
  }

  return {
    ok: true,
    legalOfficerIds,
    officers: {
      presidentId,
      vicePresidentId,
      headOfFinanceId,
    },
  };
}
