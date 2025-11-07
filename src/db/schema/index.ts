import { account, session, user, usersRelations, verification } from "./auth";
import { batch, batchRelations } from "./batch";
import { department, departmentRelations } from "./department";

export const schema = {
  user,
  session,
  account,
  verification,
  batch,
  department,
  usersRelations,
  batchRelations,
  departmentRelations,
};
