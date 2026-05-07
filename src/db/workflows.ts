import { eq } from "drizzle-orm";
import { newId } from "@/lib/id";
import {
  parseWorkflowKind,
  parseWorkflowMetadata,
  type WorkflowKind,
  type WorkflowStatus,
} from "@/lib/workflows";
import db from ".";
import { workflow } from "./schema/workflow";

export function workflowValues({
  kind,
  status = "open",
  subjectUserId,
  createdByUserId,
  metadata,
  now = new Date(),
}: {
  kind: string;
  status?: WorkflowStatus;
  subjectUserId?: string | null;
  createdByUserId?: string | null;
  metadata: Record<string, unknown>;
  now?: Date;
}) {
  const parsedKind = parseWorkflowKind(kind);
  const parsedMetadata = parseWorkflowMetadata(parsedKind, metadata);

  return {
    id: newId("workflow"),
    kind: parsedKind,
    status,
    subjectUserId: subjectUserId ?? null,
    createdByUserId: createdByUserId ?? null,
    metadata: parsedMetadata,
    createdAt: now,
    updatedAt: now,
    completedAt: status === "completed" ? now : null,
    cancelledAt: status === "cancelled" ? now : null,
  };
}

export async function createWorkflow(
  input: Parameters<typeof workflowValues>[0],
) {
  const [created] = await db
    .insert(workflow)
    .values(workflowValues(input))
    .returning();

  return created;
}

export async function updateWorkflowMetadata({
  workflowId,
  kind,
  metadata,
  status,
}: {
  workflowId: string;
  kind: WorkflowKind;
  metadata: Record<string, unknown>;
  status?: WorkflowStatus;
}) {
  const parsedMetadata = parseWorkflowMetadata(kind, metadata);
  const now = new Date();
  const updateValues = {
    metadata: parsedMetadata,
    updatedAt: now,
    ...(status ? { status } : {}),
    ...(status === "completed" ? { completedAt: now } : {}),
    ...(status === "cancelled" ? { cancelledAt: now } : {}),
  };

  const [updated] = await db
    .update(workflow)
    .set(updateValues)
    .where(eq(workflow.id, workflowId))
    .returning();

  return updated;
}
