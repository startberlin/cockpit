import { account, session, user, usersRelations, verification } from "./auth";
import { batch, batchRelations } from "./batch";
import {
  group,
  groupRelations,
  usersToGroups,
  usersToGroupsRelations,
} from "./group";

export const schema = {
  user,
  session,
  account,
  verification,
  batch,
  usersRelations,
  batchRelations,
  group,
  usersToGroups,
  groupRelations,
  usersToGroupsRelations,
};
