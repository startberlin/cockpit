import { eq } from "drizzle-orm";
import type { UserStatus } from "@/db/schema/auth";
import {
  type LegalMembershipDocumentStatus,
  type LegalMembershipState,
  legalMembership,
} from "@/db/schema/legal-membership";
import { newId } from "@/lib/id";
import db from ".";

export type ImportDocumentClassification =
  | "documents_verified"
  | "documents_missing_or_unsure"
  | "not_required";

export interface LegalMembershipClassification {
  state: LegalMembershipState;
  documentStatus: LegalMembershipDocumentStatus;
}

export function classifyImportedLegalMembership({
  userStatus,
  documents,
}: {
  userStatus: UserStatus;
  documents?: ImportDocumentClassification | null;
}): LegalMembershipClassification {
  if (userStatus === "alumni") {
    return {
      state: "former_member",
      documentStatus: "not_required",
    };
  }

  if (userStatus === "member" || userStatus === "supporting_alumni") {
    if (documents === "documents_verified") {
      return {
        state: "active_member",
        documentStatus: "verified",
      };
    }

    return {
      state: "not_member",
      documentStatus: "missing_or_unsure",
    };
  }

  return {
    state: "not_member",
    documentStatus: "missing_or_unsure",
  };
}

export function legalMembershipValues({
  userId,
  userStatus,
  documents,
  actorUserId,
  now = new Date(),
}: {
  userId: string;
  userStatus: UserStatus;
  documents?: ImportDocumentClassification | null;
  actorUserId?: string | null;
  now?: Date;
}) {
  const classification = classifyImportedLegalMembership({
    userStatus,
    documents,
  });

  return {
    id: newId("legalMembership"),
    userId,
    state: classification.state,
    documentStatus: classification.documentStatus,
    classifiedByUserId: actorUserId ?? null,
    classifiedAt: now,
    activatedAt: classification.state === "active_member" ? now : null,
    formerAt: classification.state === "former_member" ? now : null,
  };
}

export async function getLegalMembershipByUserId(userId: string) {
  return db.query.legalMembership.findFirst({
    where: eq(legalMembership.userId, userId),
  });
}

export async function upsertLegalMembershipFromImport(input: {
  userId: string;
  userStatus: UserStatus;
  documents?: ImportDocumentClassification | null;
  actorUserId?: string | null;
}) {
  const values = legalMembershipValues(input);

  const [record] = await db
    .insert(legalMembership)
    .values(values)
    .onConflictDoUpdate({
      target: legalMembership.userId,
      set: {
        state: values.state,
        documentStatus: values.documentStatus,
        classifiedByUserId: values.classifiedByUserId,
        classifiedAt: values.classifiedAt,
        activatedAt: values.activatedAt,
        formerAt: values.formerAt,
      },
    })
    .returning();

  return record;
}
