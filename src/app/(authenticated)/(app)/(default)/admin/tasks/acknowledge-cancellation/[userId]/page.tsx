import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import db from "@/db";
import { membershipTransitionRequest } from "@/db/schema/membership-transition-request";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import AcknowledgeCancellationClient from "./acknowledge-cancellation-client";

export const metadata = createMetadata({
  title: "Acknowledge Cancellation",
  description: "Acknowledge a member's cancellation request.",
});

export default async function AcknowledgeCancellationPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  const subjectUser = await db.query.user.findFirst({
    where: (u, { eq: eqFn }) => eqFn(u.id, userId),
    columns: {
      id: true,
      firstName: true,
      lastName: true,
      department: true,
    },
  });

  if (!subjectUser) notFound();

  const request = await db
    .select()
    .from(membershipTransitionRequest)
    .where(
      and(
        eq(membershipTransitionRequest.userId, userId),
        eq(membershipTransitionRequest.type, "cancellation"),
        eq(membershipTransitionRequest.reason, "resigned"),
      ),
    )
    .then((rows) => {
      rows.sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
      return rows[0] ?? null;
    });

  if (!request) notFound();

  if (
    !(await can("membership.cancellation.view", {
      department: subjectUser.department,
    }))
  ) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  const canAct =
    request.status === "pending" &&
    currentUser?.id !== subjectUser.id &&
    (await can("membership.cancellation.acknowledge", {
      department: subjectUser.department,
    }));

  return (
    <>
      <BreadcrumbCrumb
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "Tasks", href: "/admin/tasks" },
          { label: "Cancellation acknowledgement" },
        ]}
      />
      <AcknowledgeCancellationClient
        request={request}
        subjectUser={{
          id: subjectUser.id,
          name: `${subjectUser.firstName} ${subjectUser.lastName}`.trim(),
        }}
        canAct={canAct}
      />
    </>
  );
}
