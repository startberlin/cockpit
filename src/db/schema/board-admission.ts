import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { legalMembership } from "./legal-membership";

export const officerFunction = pgEnum("officer_function", [
  "president",
  "vice_president",
  "head_of_finance",
]);

export type OfficerFunction = (typeof officerFunction.enumValues)[number];

export const boardVoteValue = pgEnum("board_vote_value", [
  "yes",
  "no",
  "abstain",
  "procedure_objection",
]);

export type BoardVoteValue = (typeof boardVoteValue.enumValues)[number];

export const boardResolution = pgTable("board_resolution", {
  id: text("id").primaryKey(),
  legalMembershipId: text("legal_membership_id")
    .notNull()
    .unique()
    .references(() => legalMembership.id, { onDelete: "no action" }),
  resolutionText: text("resolution_text").notNull(),
  resolutionTextVersion: text("resolution_text_version").notNull(),
  resolutionTextHash: text("resolution_text_hash").notNull(),
  billingApplies: boolean("billing_applies").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const admissionParticipant = pgTable(
  "admission_participant",
  {
    id: text("id").primaryKey(),
    legalMembershipId: text("legal_membership_id")
      .notNull()
      .references(() => legalMembership.id, { onDelete: "no action" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "no action" }),
    officerFunction: officerFunction("officer_function").notNull(),
    assignedAt: timestamp("assigned_at").notNull().defaultNow(),
  },
  (t) => [
    index("admission_participant_legal_membership_id_idx").on(
      t.legalMembershipId,
    ),
  ],
);

export const boardVote = pgTable(
  "board_vote",
  {
    id: text("id").primaryKey(),
    legalMembershipId: text("legal_membership_id")
      .notNull()
      .references(() => legalMembership.id, { onDelete: "no action" }),
    voterUserId: text("voter_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "no action" }),
    value: boardVoteValue("value").notNull(),
    displayedResolutionHash: text("displayed_resolution_hash").notNull(),
    castAt: timestamp("cast_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.legalMembershipId, t.voterUserId)],
);

export const boardResolutionRelations = relations(
  boardResolution,
  ({ one }) => ({
    legalMembership: one(legalMembership, {
      fields: [boardResolution.legalMembershipId],
      references: [legalMembership.id],
    }),
  }),
);

export const admissionParticipantRelations = relations(
  admissionParticipant,
  ({ one }) => ({
    legalMembership: one(legalMembership, {
      fields: [admissionParticipant.legalMembershipId],
      references: [legalMembership.id],
    }),
    user: one(user, {
      fields: [admissionParticipant.userId],
      references: [user.id],
    }),
  }),
);

export const boardVoteRelations = relations(boardVote, ({ one }) => ({
  legalMembership: one(legalMembership, {
    fields: [boardVote.legalMembershipId],
    references: [legalMembership.id],
  }),
  voter: one(user, {
    fields: [boardVote.voterUserId],
    references: [user.id],
  }),
}));
