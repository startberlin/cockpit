import { createHash } from "node:crypto";
import db from "@/db";
import {
  admissionParticipant,
  boardResolution,
} from "@/db/schema/board-admission";
import { newId } from "@/lib/id";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createAdmissionWorkflow(
  tx: Tx,
  {
    legalMembershipId,
    subjectUser,
    officers,
    billingApplies,
  }: {
    legalMembershipId: string;
    subjectUser: { firstName: string; lastName: string };
    officers: {
      presidentId: string;
      vicePresidentId: string;
      headOfFinanceId: string;
    };
    billingApplies: boolean;
  },
): Promise<void> {
  const resolutionText = `Der Vorstand beschließt die Aufnahme von ${subjectUser.firstName} ${subjectUser.lastName} als ordentliches Mitglied des Vereins START Berlin e.V.`;
  const resolutionTextVersion = "v1";
  const resolutionTextHash = createHash("sha256")
    .update(resolutionText)
    .digest("hex");

  await tx.insert(boardResolution).values({
    id: newId("boardResolution"),
    legalMembershipId,
    resolutionText,
    resolutionTextVersion,
    resolutionTextHash,
    billingApplies,
  });

  const { presidentId, vicePresidentId, headOfFinanceId } = officers;

  await tx.insert(admissionParticipant).values([
    {
      id: newId("admissionParticipant"),
      legalMembershipId,
      userId: presidentId,
      officerFunction: "president",
    },
    {
      id: newId("admissionParticipant"),
      legalMembershipId,
      userId: vicePresidentId,
      officerFunction: "vice_president",
    },
    {
      id: newId("admissionParticipant"),
      legalMembershipId,
      userId: headOfFinanceId,
      officerFunction: "head_of_finance",
    },
  ]);
}
