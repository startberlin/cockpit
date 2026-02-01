import { eq, sql } from "drizzle-orm";
import { actionClient } from "@/lib/action-client";
import db from ".";
import { group, usersToGroups } from "./schema/group";

export interface PublicGroup {
  id: string;
  name: string;
  slug: string;
  memberCount: number;
  adminCount: number;
  isMember: boolean;
}

export const getAllGroups = actionClient.action(
  async ({ ctx }): Promise<PublicGroup[]> => {
    const userId = ctx.user.id;

    const groups = await db
      .select({
        id: group.id,
        name: group.name,
        slug: group.slug,
        memberCount: sql<number>`count(${usersToGroups.userId})::int`,
        adminCount: sql<number>`count(case when ${usersToGroups.role} = 'admin' then 1 end)::int`,
        isMember: sql<boolean>`bool_or(${usersToGroups.userId} = ${userId})`,
      })
      .from(group)
      .leftJoin(usersToGroups, eq(group.id, usersToGroups.groupId))
      .groupBy(group.id);

    return groups.map((g) => ({
      ...g,
      isMember: g.isMember ?? false,
    }));
  },
);

export const getMyGroups = actionClient.action(
  async (): Promise<PublicGroup[]> => {
    const allGroups = await getAllGroups();
    if (!allGroups.data) {
      return [];
    }
    return allGroups.data.filter((g) => g.isMember);
  },
);

export async function checkSlugAvailability(slug: string): Promise<boolean> {
  const existing = await db
    .select({ id: group.id })
    .from(group)
    .where(eq(group.slug, slug))
    .limit(1);

  return existing.length === 0;
}
