import type { UserAuthority } from "./model";
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

function idsWithPosition(boardMembers: UserAuthority[], position: OfficerPosition) {
  return boardMembers
    .filter((a) => a.positions.some((p) => p.scope === "global" && p.position === position))
    .map((a) => a.userId);
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
  const officerUserIds: Record<OfficerPosition, string[]> = {
    president: idsWithPosition(boardMembers, "president"),
    vice_president: idsWithPosition(boardMembers, "vice_president"),
    head_of_finance: idsWithPosition(boardMembers, "head_of_finance"),
  };
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
