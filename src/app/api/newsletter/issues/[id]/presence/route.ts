import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/db/user";
import { env } from "@/env";
import {
  heartbeatIssuePresence,
  PresenceRequestError,
  releaseIssuePresence,
} from "@/internal-apps/newsletter/lib/presence-server";
import { can } from "@/lib/permissions/server";

const sessionSchema = z.object({ editorSessionId: z.uuid() }).strict();
const heartbeatSchema = sessionSchema.extend({ isChanging: z.boolean() });
const responseHeaders = { "Cache-Control": "private, no-store" };
type RouteContext = { params: Promise<{ id: string }> };

async function handlePresence(request: Request, { params }: RouteContext) {
  const origin = request.headers.get("origin");
  if (
    origin &&
    origin !== new URL(request.url).origin &&
    origin !== new URL(env.NEXT_PUBLIC_COCKPIT_URL).origin
  ) {
    return NextResponse.json(
      { error: "Not authorized." },
      { status: 403, headers: responseHeaders },
    );
  }
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return NextResponse.json(
      { error: "Not signed in." },
      { status: 401, headers: responseHeaders },
    );
  }
  if (!(await can("apps.newsletter.access"))) {
    return NextResponse.json(
      { error: "Not authorized." },
      { status: 403, headers: responseHeaders },
    );
  }

  const { id: issueId } = await params;
  if (!issueId || issueId.length > 128) {
    return NextResponse.json(
      { error: "Invalid issue." },
      { status: 400, headers: responseHeaders },
    );
  }
  const body = await request.json().catch(() => null);
  const parsed = (
    request.method === "DELETE" ? sessionSchema : heartbeatSchema
  ).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid editor session." },
      { status: 400, headers: responseHeaders },
    );
  }

  const session = {
    issueId,
    editorSessionId: parsed.data.editorSessionId,
    userId: currentUser.id,
  };
  try {
    if (request.method === "DELETE") {
      await releaseIssuePresence(session);
      return new Response(null, { status: 204, headers: responseHeaders });
    }
    const result = await heartbeatIssuePresence({
      ...session,
      isChanging: heartbeatSchema.parse(parsed.data).isChanging,
    });
    return NextResponse.json(result, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof PresenceRequestError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: responseHeaders },
      );
    }
    console.error("[newsletter] Could not update editor presence", error);
    return NextResponse.json(
      { error: "Editor presence could not be checked." },
      { status: 500, headers: responseHeaders },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  return handlePresence(request, context);
}

export async function DELETE(request: Request, context: RouteContext) {
  return handlePresence(request, context);
}
