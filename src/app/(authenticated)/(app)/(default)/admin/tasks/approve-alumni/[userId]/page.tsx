import { notFound } from "next/navigation";
import db from "@/db";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import { can } from "@/lib/permissions/server";
import ApproveAlumniClient from "./approve-alumni-client";

export const metadata = createMetadata({
  title: "Approve Alumni Request",
  description: "Review and decide on a membership transition request.",
});

export default async function ApproveAlumniPage({
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
      email: true,
    },
  });

  if (!subjectUser) notFound();

  const request = await db.query.membershipTransitionRequest
    .findMany({
      where: (t, { eq: eqFn }) => eqFn(t.userId, userId),
    })
    .then(
      (rows) =>
        rows.find(
          (r) =>
            (r.type === "alumni_request" ||
              r.type === "supporting_alumni_request") &&
            r.status === "pending",
        ) ?? null,
    );

  if (!request) notFound();

  if (
    !(await can("membership.transition.view", {
      department: subjectUser.department,
    }))
  ) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  const canAct =
    currentUser?.id !== subjectUser.id &&
    (await can("membership.transition.decide", {
      department: subjectUser.department,
    }));

  return (
    <ApproveAlumniClient
      request={request}
      subjectUser={{
        id: subjectUser.id,
        name: `${subjectUser.firstName} ${subjectUser.lastName}`.trim(),
        email: subjectUser.email ?? "",
      }}
      canAct={canAct}
    />
  );
}
