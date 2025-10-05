import { drizzle } from "drizzle-orm/node-postgres";
import { reset } from "drizzle-seed";
import { schema } from "@/db/schema";
import { user } from "@/db/schema/auth";
import { batch } from "@/db/schema/batch";
import { department } from "@/db/schema/department";
import { env } from "@/env";
import { newId } from "@/lib/id";

async function main() {
  const db = drizzle(env.DATABASE_URL);

  await reset(db, schema);

  await db.transaction(
    async (tx) => {
      // Insert batches
      await tx.insert(batch).values([
        {
          number: 1,
          startDate: "2023-01-01",
        },
        { number: 2, startDate: "2024-01-01" },
        { number: 3, startDate: "2025-01-01" },
      ]);

      const peterPartnershipsId = newId("user");
      const oscarOperationsId = newId("user");
      const carolineCommunityId = newId("user");
      const gustavGrowthId = newId("user");
      const emilyEventsId = newId("user");

      // Insert departments
      await tx.insert(department).values([
        {
          id: "partnerships",
          name: "Partnerships",
          leadMemberId: peterPartnershipsId,
        },
        {
          id: "operations",
          name: "Operations & Digital",
          leadMemberId: oscarOperationsId,
        },
        {
          id: "community",
          name: "Community & HR",
          leadMemberId: carolineCommunityId,
        },
        {
          id: "growth",
          name: "Growth",
          leadMemberId: gustavGrowthId,
        },
        {
          id: "events",
          name: "Events",
          leadMemberId: emilyEventsId,
        },
      ]);

      // Insert users
      await tx.insert(user).values([
        {
          id: peterPartnershipsId,
          name: "Peter Partnerships",
          firstName: "Peter",
          lastName: "Partnerships",
          email: "peter-partnerships+it@start-berlin.com",
          personalEmail: "peter-partnerships-personal+it@start-berlin.com",
          batchNumber: 1,
          departmentId: "partnerships",
          emailVerified: true,
        },
        {
          id: emilyEventsId,
          name: "Martha Marketing",
          firstName: "Martha",
          lastName: "Events",
          email: "emily-events+it@start-berlin.com",
          personalEmail: "emily-events-personal+it@start-berlin.com",
          batchNumber: 2,
          departmentId: "events",
          emailVerified: true,
        },
        {
          id: gustavGrowthId,
          name: "Gustav Growth",
          firstName: "Gustav",
          lastName: "Growth",
          email: "greta-growth+it@start-berlin.com",
          personalEmail: "greta-growth-personal+it@start-berlin.com",
          batchNumber: 3,
          departmentId: "growth",
          emailVerified: true,
        },
        {
          id: oscarOperationsId,
          name: "Oscar Operations",
          firstName: "Oscar",
          lastName: "Operations",
          email: "oscar-operations+it@start-berlin.com",
          personalEmail: "oscar-operations-personal+it@start-berlin.com",
          batchNumber: 2,
          departmentId: "operations",
          emailVerified: true,
        },
        {
          id: carolineCommunityId,
          name: "Caroline Community",
          firstName: "Caroline",
          lastName: "Community",
          email: "caroline-community+it@start-berlin.com",
          personalEmail: "caroline-community-personal+it@start-berlin.com",
          batchNumber: 1,
          departmentId: "community",
          emailVerified: true,
        },
      ]);
    },
    { deferrable: true },
  );
}

main();
