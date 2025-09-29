import { createHash } from "crypto";
import { WorkflowApprovalEmail } from "@/emails/workflow-approval";
import { WorkflowConfirmationEmail } from "@/emails/workflow-confirmation";
import { inngest } from "@/lib/inngest";
import { resend } from "@/lib/resend";

export const startWorkflow = inngest.createFunction(
  { id: "start-workflow" },
  { event: "test/workflow.start" },
  async ({ event, step }) => {
    const { email, firstName } = event.data;

    // Generate a deterministic workflowId based on email and timestamp
    // This ensures the same workflowId across function retries while being unique per workflow
    const timestamp = event.ts || Date.now();
    const hash = createHash("sha256")
      .update(`${email}:${timestamp}`)
      .digest("hex")
      .substring(0, 8);
    const workflowId = `wf_${timestamp}_${hash}`;

    // Generate approval URL (you can customize this based on your app structure)
    const approvalUrl = `${process.env.VERCEL_URL || "http://localhost:3000"}/approve?workflowId=${workflowId}&token=${Buffer.from(`${workflowId}:${email}`).toString("base64")}`;

    await step.run("send-approval-email", async () => {
      await resend.emails.send({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: email,
        subject: "Workflow Approval Required",
        react: WorkflowApprovalEmail({
          firstName,
          workflowId,
          approvalUrl,
        }),
      });
    });

    // Wait for the approval event
    const approvalEvent = await step.waitForEvent("wait-for-approval", {
      event: "test/workflow.approval",
      timeout: "1h", // Wait up to 1 hour for approval
      if: `async.data.workflowId == "${workflowId}"`,
    });

    if (approvalEvent) {
      // Send confirmation email after approval
      await step.run("send-confirmation-email", async () => {
        await resend.emails.send({
          from: "START Berlin <notifications@cockpit.start-berlin.com>",
          to: email,
          subject: "Workflow Approved Successfully",
          react: WorkflowConfirmationEmail({
            firstName,
            workflowId,
          }),
        });
      });

      return {
        message: `Workflow approved and confirmation sent to ${email}`,
        workflowId,
        status: "approved",
        approvedAt: approvalEvent.data.approvedAt,
      };
    } else {
      return {
        message: `Workflow timed out waiting for approval`,
        workflowId,
        status: "timeout",
      };
    }
  },
);
