import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const workflowId = searchParams.get("workflowId");
  const token = searchParams.get("token");

  if (!workflowId || !token) {
    return NextResponse.json(
      { error: "Missing workflowId or token" },
      { status: 400 },
    );
  }

  try {
    // Decode the token to get workflowId and email
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [tokenWorkflowId, email] = decoded.split(":");

    // Verify the token matches the workflowId
    if (tokenWorkflowId !== workflowId) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Extract firstName from email (simple approach - you might want to get this from your database)
    const firstName = email.split("@")[0];

    // Trigger the approval event
    await inngest.send({
      name: "test/workflow.approval",
      data: {
        email,
        firstName,
        workflowId,
        approvedAt: new Date().toISOString(),
      },
    });

    // Return a simple success page
    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Workflow Approved</title>
          <style>
            body { 
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              max-width: 600px;
              margin: 50px auto;
              padding: 20px;
              text-align: center;
            }
            .success { color: #10b981; }
            .card {
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 40px;
              background: #f9fafb;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <h1 class="success">✅ Workflow Approved</h1>
            <p>Thank you! Your workflow approval has been successfully recorded.</p>
            <p><strong>Workflow ID:</strong> ${workflowId}</p>
            <p>A confirmation email will be sent to ${email} shortly.</p>
          </div>
        </body>
      </html>
      `,
      {
        status: 200,
        headers: {
          "Content-Type": "text/html",
        },
      },
    );
  } catch (error) {
    console.error("Error approving workflow:", error);
    return NextResponse.json(
      { error: "Failed to approve workflow" },
      { status: 500 },
    );
  }
}
