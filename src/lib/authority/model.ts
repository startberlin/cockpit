import type { Department, UserStatus } from "@/db/schema/auth";

export const globalOrganizationPositions = [
  "president",
  "vice_president",
  "head_of_finance",
] as const;

export type GlobalOrganizationPosition =
  (typeof globalOrganizationPositions)[number];

export const departmentHeadPosition = "department_head";

export const departmentCoLeadPosition = "department_co_lead";

// Positions that grant department-lead authority. A co-lead receives the same
// permissions and is included in the same workflows as the head. A department
// has at most one head but any number of co-leads.
export const departmentLeadPositions = [
  departmentHeadPosition,
  departmentCoLeadPosition,
] as const;

export type DepartmentLeadPosition = (typeof departmentLeadPositions)[number];

export function isDepartmentLeadPosition(
  position: string,
): position is DepartmentLeadPosition {
  return (departmentLeadPositions as readonly string[]).includes(position);
}

export const organizationPositions = [
  ...globalOrganizationPositions,
  ...departmentLeadPositions,
] as const;

export type OrganizationPosition = (typeof organizationPositions)[number];

export const globalAccessGrants = [
  "super_admin",
  "admin",
  "finance_admin",
  "people_admin",
  "members_group_exporter",
] as const;

export type GlobalAccessGrant = (typeof globalAccessGrants)[number];

export const accessGrants = [...globalAccessGrants] as const;

export type AccessGrant = (typeof accessGrants)[number];

export const authorityScopes = ["global", "department"] as const;

export type AuthorityScope = (typeof authorityScopes)[number];

export const activeAuthorityStatuses = [
  "member",
  "supporting_alumni",
] as const satisfies UserStatus[];

export type ActiveAuthorityStatus = (typeof activeAuthorityStatuses)[number];

export type PositionAssignment =
  | {
      position: GlobalOrganizationPosition;
      scope: "global";
    }
  | {
      position: DepartmentLeadPosition;
      scope: "department";
      department: Department;
    };

export type GrantAssignment = {
  grant: GlobalAccessGrant;
};

export interface UserAuthority {
  userId: string;
  status: UserStatus;
  department: Department | null;
  positions: PositionAssignment[];
  grants: GrantAssignment[];
}

export function isActiveAuthorityStatus(
  status: UserStatus,
  allowedStatuses: readonly UserStatus[] = activeAuthorityStatuses,
) {
  return allowedStatuses.includes(status);
}
