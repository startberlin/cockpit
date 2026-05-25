export {
  type BoardRosterSetup,
  getBoardRosterSetup,
} from "@/lib/authority/board-roster";
export type {
  GrantAssignment,
  PositionAssignment,
  UserAuthority,
} from "@/lib/authority/model";
export {
  type Action,
  evaluateAuth,
  type GlobalAction,
  type GroupScope,
  type GroupScopedAction,
  hasAdminGrant,
  hasPeopleAdminGrant,
  isGlobalAction,
  isGroupScopedAction,
  isLegalOfficer,
  isUnscopedViewAction,
  isUserScopedAction,
  type UnscopedViewAction,
  type UserScope,
  type UserScopedAction,
} from "./evaluate";
