import { sql } from "drizzle-orm";
import {
  customType,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { z } from "zod";
import { user } from "./auth";

function validatedJsonb<T>(schema: z.ZodType<T>) {
  return customType<{ data: T; driverData: unknown }>({
    dataType() {
      return "jsonb";
    },
    fromDriver(val: unknown): T {
      return schema.parse(val);
    },
    toDriver(val: T): string {
      return JSON.stringify(val);
    },
  });
}

export const boardParticipantSchema = z.object({
  userId: z.string(),
  officerFunction: z.enum(["president", "vice_president", "head_of_finance"]),
});

export const boardVoteSchema = z.object({
  voterUserId: z.string(),
  value: z.enum(["yes", "no"]),
  castAt: z.string(),
  displayedResolutionHash: z.string(),
});

export type OfficerFunction =
  | "president"
  | "vice_president"
  | "head_of_finance";

export type BoardVoteValue = "yes" | "no";

export type BoardParticipant = z.infer<typeof boardParticipantSchema>;
export type BoardVote = z.infer<typeof boardVoteSchema>;

export const legalMembershipStatus = pgEnum("legal_membership_status", [
  "admission_pending",
  "application_pending",
  "membership_reconfirmation_pending",
  "processing",
  "active",
  "manual_followup",
  "cancelled",
]);

export type LegalMembershipStatus =
  (typeof legalMembershipStatus.enumValues)[number];

// Statuses that represent a tenure which blocks new proposals for the same user.
export const LIVE_TENURE_STATUSES = [
  "admission_pending",
  "application_pending",
  "membership_reconfirmation_pending",
  "processing",
  "active",
] as const satisfies LegalMembershipStatus[];

// Statuses that represent any tenure a user has that is still visible / queryable.
// Includes manual_followup in addition to LIVE_TENURE_STATUSES.
export const ACTIVE_TENURE_STATUSES = [
  "admission_pending",
  "application_pending",
  "membership_reconfirmation_pending",
  "processing",
  "active",
  "manual_followup",
] as const satisfies LegalMembershipStatus[];

export const legalMembership = pgTable(
  "legal_membership",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "no action" }),
    status: legalMembershipStatus("status").notNull(),
    inngestRunId: text("inngest_run_id"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    activatedAt: timestamp("activated_at"),
    importedPaidThroughAt: timestamp("imported_paid_through_at"),
    endedAt: timestamp("ended_at"),
    boardResolutionText: text("board_resolution_text"),
    boardResolutionHash: text("board_resolution_hash"),
    boardParticipants: validatedJsonb(z.array(boardParticipantSchema))(
      "board_participants",
    ),
    boardVotes: validatedJsonb(z.array(boardVoteSchema))("board_votes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    // Prevents two concurrent active tenures for the same user.
    uniqueIndex("legal_membership_active_tenure_idx")
      .on(t.userId)
      .where(
        sql`${t.status} IN ('admission_pending', 'application_pending', 'membership_reconfirmation_pending', 'processing', 'active')`,
      ),
  ],
);
// Relations defined in schema/index.ts to avoid circular imports.
