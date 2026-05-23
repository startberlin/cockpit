import type { Department, UserStatus } from "@/db/schema/auth";

export const globalOrganizationPositions = [
  "president",
  "vice_president",
  "head_of_finance",
] as const;

export type GlobalOrganizationPosition =
  (typeof globalOrganizationPositions)[number];

export const departmentHeadPosition = "department_head";

export const organizationPositions = [
  ...globalOrganizationPositions,
  departmentHeadPosition,
] as const;

export type OrganizationPosition = (typeof organizationPositions)[number];

export const globalAccessGrants = [
  "super_admin",
  "admin",
  "finance_admin",
  "people_admin",
] as const;

export type GlobalAccessGrant = (typeof globalAccessGrants)[number];

export const accessGrants = [...globalAccessGrants] as const;

export type AccessGrant = (typeof accessGrants)[number];

export const authorityScopes = ["global", "department"] as const;

export type AuthorityScope = (typeof authorityScopes)[number];

export const activeAuthorityStatuses = [
  "member",
] as const satisfies UserStatus[];

export type ActiveAuthorityStatus = (typeof activeAuthorityStatuses)[number];

export type PositionAssignment =
  | {
      position: GlobalOrganizationPosition;
      scope: "global";
    }
  | {
      position: typeof departmentHeadPosition;
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
