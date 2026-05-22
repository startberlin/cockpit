import { and, eq } from "drizzle-orm";
import db from "@/db";
import { getFyiRecipients, getPositionAssignments } from "@/db/authority";
import { user } from "@/db/schema/auth";
import { legalMembership } from "@/db/schema/legal-membership";
import BoardResolutionTaskAssignedEmail from "@/emails/board-resolution/board-resolution-task-assigned";
import MembershipAdmissionCompletedBoardEmail from "@/emails/membership/admission/membership-admission-completed-board";
import MembershipAdmissionConfirmedEmail from "@/emails/membership/admission/membership-admission-confirmed";
import MembershipApplicationReadyEmail from "@/emails/membership/admission/membership-application-ready";
import MembershipApplicationSubmittedEmail from "@/emails/membership/admission/membership-application-submitted";
import { env } from "@/env";
import {
  computeResolutionRoles,
  computeVoteOutcome,
  type VoteOutcome,
} from "@/lib/board-resolution-rules";
import { DEPARTMENT_NAMES } from "@/lib/departments";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";
import {
  archiveLegalDocument,
  downloadArchivedDocument,
} from "@/lib/legal-documents/drive-archive";
import { mergePdfsWithAttachments } from "@/lib/legal-documents/pdf-merge";
import {
  readFinanzordnungBuffer,
  readSatzungBuffer,
} from "@/lib/legal-documents/static-documents";
import { renderAdmissionConfirmationTemplate } from "@/lib/legal-documents/templates/admission-confirmation";
import { renderAppendixPage } from "@/lib/legal-documents/templates/appendix";
import { renderBoardResolutionTemplate } from "@/lib/legal-documents/templates/board-resolution";
import { ROLE_DISPLAY } from "@/lib/legal-documents/templates/brand";
import { renderMembershipApplicationTemplate } from "@/lib/legal-documents/templates/membership-application";

export const membershipAdmissionWorkflow = inngest.createFunction(
  {
    id: "membership-admission-workflow",
    name: "Membership Admission Workflow",
    triggers: [{ event: events.admissionWorkflowStarted }],
    cancelOn: [
      {
        event: events.cancellationRequested.name,
        if: "async.data.subjectUserId == event.data.userId",
      },
    ],
  },
  async ({ event, step, runId }) => {
    const { legalMembershipId, subjectUserId } = event.data;

    // Step 1: Store the Inngest run ID and load the subject user.
    const subject = await step.run("store-inngest-run-id", async () => {
      await db
        .update(legalMembership)
        .set({ inngestRunId: runId, status: "admission_pending" })
        .where(eq(legalMembership.id, legalMembershipId));

      const subjectUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { firstName: true, lastName: true, email: true, status: true },
      });

      return {
        firstName: subjectUser?.firstName ?? "",
        lastName: subjectUser?.lastName ?? "",
        email: subjectUser?.email ?? "",
        status: subjectUser?.status,
      };
    });

    const subjectName =
      subject.firstName || subject.lastName
        ? `${subject.firstName} ${subject.lastName}`.trim()
        : subjectUserId;

    // Step 1b: Load board notification data from legalMembership JSON.
    const boardTaskData = await step.run("load-board-task-data", async () => {
      const lm = await db.query.legalMembership.findFirst({
        where: (l, { eq: eqFn }) => eqFn(l.id, legalMembershipId),
        columns: { boardParticipants: true },
      });

      const participantIds = (lm?.boardParticipants ?? []).map((p) => p.userId);

      const participantUsers =
        participantIds.length > 0
          ? await db.query.user.findMany({
              where: (u, { inArray }) => inArray(u.id, participantIds),
              columns: { id: true, email: true, firstName: true },
            })
          : [];

      const participants = participantUsers.map((u) => ({
        userId: u.id,
        email: u.email,
        firstName: u.firstName,
      }));

      return {
        subjectName,
        resolutionUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/people/resolutions/${legalMembershipId}`,
        participants,
      };
    });

    // Step 1c: Send one email per board participant.
    for (const participant of boardTaskData.participants) {
      await step.run(
        `send-board-task-email-${participant.userId}`,
        async () => {
          if (!participant.email) return;
          await sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: participant.email,
            subject: `Action required: vote on ${boardTaskData.subjectName}'s membership`,
            react: BoardResolutionTaskAssignedEmail({
              firstName: participant.firstName ?? "",
              subjectName: boardTaskData.subjectName,
              resolutionUrl: boardTaskData.resolutionUrl,
            }),
          });
        },
      );
    }

    // Steps 2–4: Vote loop. Inside each round, poll for a vote with 3-day inner
    // waits and re-email the still-pending participants until a vote arrives
    // or the 90-day budget for that round expires.
    let voteRound = 0;
    let resolution: VoteOutcome = "pending";

    const VOTE_TOTAL_DAYS = 90;
    const REMINDER_INTERVAL_DAYS = 3;

    while (voteRound < 3 && resolution === "pending") {
      voteRound++;

      let elapsed = 0;
      let voteEvent: Awaited<ReturnType<typeof step.waitForEvent>> = null;
      while (elapsed < VOTE_TOTAL_DAYS) {
        const wait = Math.min(
          REMINDER_INTERVAL_DAYS,
          VOTE_TOTAL_DAYS - elapsed,
        );
        voteEvent = await step.waitForEvent(
          `wait-for-board-vote-r${voteRound}-${elapsed}d`,
          {
            event: events.boardVoteCast,
            timeout: `${wait}d`,
            if: "async.data.legalMembershipId == event.data.legalMembershipId",
          },
        );
        if (voteEvent) break;
        elapsed += wait;
        if (elapsed < VOTE_TOTAL_DAYS) {
          const daysOpen = elapsed;
          await step.run(
            `send-vote-reminder-r${voteRound}-${elapsed}d`,
            async () => {
              const lm = await db.query.legalMembership.findFirst({
                where: (l, { eq: eqFn }) => eqFn(l.id, legalMembershipId),
                columns: { boardParticipants: true, boardVotes: true },
              });
              const voted = new Set(
                (lm?.boardVotes ?? []).map((v) => v.voterUserId),
              );
              const pendingIds = (lm?.boardParticipants ?? [])
                .map((p) => p.userId)
                .filter((id) => !voted.has(id));
              if (pendingIds.length === 0) return;

              const pendingUsers = await db.query.user.findMany({
                where: (u, { inArray }) => inArray(u.id, pendingIds),
                columns: { id: true, email: true, firstName: true },
              });
              await Promise.all(
                pendingUsers
                  .filter((u) => u.email)
                  .map((u) =>
                    sendEmail({
                      from: "START Berlin <notifications@cockpit.start-berlin.com>",
                      to: u.email!,
                      subject: `Reminder: vote on ${subjectName}'s membership`,
                      react: BoardResolutionTaskAssignedEmail({
                        firstName: u.firstName ?? "",
                        subjectName,
                        resolutionUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/people/resolutions/${legalMembershipId}`,
                        isReminder: true,
                        daysOpen,
                      }),
                    }),
                  ),
              );
            },
          );
        }
      }

      if (voteEvent === null) {
        await step.run(`timeout-to-manual-followup-r${voteRound}`, async () => {
          await db
            .update(legalMembership)
            .set({ status: "manual_followup" })
            .where(eq(legalMembership.id, legalMembershipId));
        });
        return { outcome: "timeout", legalMembershipId };
      }

      resolution = await step.run(
        `evaluate-votes-round-${voteRound}`,
        async () => {
          const lm = await db.query.legalMembership.findFirst({
            where: (l, { eq: eqFn }) => eqFn(l.id, legalMembershipId),
            columns: { boardVotes: true },
          });
          const votes = lm?.boardVotes ?? [];
          return computeVoteOutcome(votes.map((v) => v.value));
        },
      );
    }

    if (resolution === "manual_followup") {
      await step.run("reject-to-manual-followup", async () => {
        await db
          .update(legalMembership)
          .set({ status: "manual_followup" })
          .where(eq(legalMembership.id, legalMembershipId));
      });
      return { outcome: "manual_followup", legalMembershipId };
    }

    if (resolution !== "approved") {
      await step.run("unresolved-to-manual-followup", async () => {
        await db
          .update(legalMembership)
          .set({ status: "manual_followup" })
          .where(eq(legalMembership.id, legalMembershipId));
      });
      return { outcome: "unresolved", legalMembershipId };
    }

    await step.run("mark-application-pending", async () => {
      await db
        .update(legalMembership)
        .set({ status: "application_pending" })
        .where(eq(legalMembership.id, legalMembershipId));
    });

    await step.run("notify-applicant-board-approved", async () => {
      if (!subject.email) {
        throw new Error(`Missing email for subject user ${subjectUserId}`);
      }
      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subject.email,
        subject: "Complete your START Berlin membership application",
        react: MembershipApplicationReadyEmail({
          firstName: subject.firstName,
          applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
      });
    });

    // Wait for the applicant to submit, sending a reminder every 3 days until
    // submission or the 90-day budget expires.
    const APPLICATION_TOTAL_DAYS = 90;
    let applicationElapsed = 0;
    let applicationEvent: Awaited<ReturnType<typeof step.waitForEvent>> = null;
    while (applicationElapsed < APPLICATION_TOTAL_DAYS) {
      const wait = Math.min(
        REMINDER_INTERVAL_DAYS,
        APPLICATION_TOTAL_DAYS - applicationElapsed,
      );
      applicationEvent = await step.waitForEvent(
        `wait-for-application-submitted-${applicationElapsed}d`,
        {
          event: events.applicationSubmitted,
          timeout: `${wait}d`,
          if: "async.data.legalMembershipId == event.data.legalMembershipId",
        },
      );
      if (applicationEvent) break;
      applicationElapsed += wait;
      if (applicationElapsed < APPLICATION_TOTAL_DAYS) {
        const daysOpen = applicationElapsed;
        await step.run(
          `send-application-reminder-${applicationElapsed}d`,
          async () => {
            if (!subject.email) return;
            await sendEmail({
              from: "START Berlin <notifications@cockpit.start-berlin.com>",
              to: subject.email,
              subject:
                "Reminder: complete your START Berlin membership application",
              react: MembershipApplicationReadyEmail({
                firstName: subject.firstName,
                applicationUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
                isReminder: true,
                daysOpen,
              }),
            });
          },
        );
      }
    }

    if (applicationEvent === null) {
      await step.run("application-timeout-to-manual-followup", async () => {
        await db
          .update(legalMembership)
          .set({ status: "manual_followup" })
          .where(eq(legalMembership.id, legalMembershipId));
      });
      return { outcome: "application_timeout", legalMembershipId };
    }

    await step.run("mark-processing", async () => {
      await db
        .update(legalMembership)
        .set({ status: "processing" })
        .where(eq(legalMembership.id, legalMembershipId));
    });

    // Step 9a: Render and archive board resolution PDF.
    // Returns driveFileId — Inngest caches this for downstream steps.
    const { driveFileId: boardResolutionFileDriveId } = await step.run(
      "archive-board-resolution",
      async () => {
        const lm = await db.query.legalMembership.findFirst({
          where: (l, { eq: eqFn }) => eqFn(l.id, legalMembershipId),
          columns: {
            boardResolutionText: true,
            boardResolutionHash: true,
            boardParticipants: true,
            boardVotes: true,
          },
        });

        if (!lm?.boardResolutionText || !lm.boardResolutionHash) {
          throw new Error(
            `No board resolution data found for ${legalMembershipId}`,
          );
        }

        const participants = lm.boardParticipants ?? [];
        const votes = lm.boardVotes ?? [];

        const participantIds = participants.map((p) => p.userId);
        const participantUsers =
          participantIds.length > 0
            ? await db.query.user.findMany({
                where: (u, { inArray }) => inArray(u.id, participantIds),
                columns: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              })
            : [];

        const userNameById = new Map(
          participantUsers.map((u) => [
            u.id,
            { firstName: u.firstName, lastName: u.lastName },
          ]),
        );

        const mappedParticipants = participants.map((p) => {
          const names = userNameById.get(p.userId);
          return {
            userId: p.userId,
            name: names
              ? `${names.firstName} ${names.lastName}`.trim()
              : p.userId,
            officerFunction: p.officerFunction,
          };
        });

        const mappedVotes = votes.map((v) => {
          const voterNames = userNameById.get(v.voterUserId);
          return {
            voterUserId: v.voterUserId,
            voterName: voterNames
              ? `${voterNames.firstName} ${voterNames.lastName}`.trim()
              : v.voterUserId,
            value: v.value,
            castAt: new Date(v.castAt),
          };
        });

        const roles = computeResolutionRoles(
          participants.map((p) => ({
            userId: p.userId,
            officerFunction: p.officerFunction,
          })),
          votes.map((v) => ({ voterUserId: v.voterUserId, value: v.value })),
        );

        if (!roles) {
          throw new Error(
            `Cannot determine Sitzungsleiter/Protokollführer for ${legalMembershipId}: fewer than 2 yes-voting participants found`,
          );
        }

        const sitzungsleiterNames = userNameById.get(
          roles.sitzungsleiter.userId,
        );
        const protokollfuehrerNames = userNameById.get(
          roles.protokollfuehrer.userId,
        );

        const { renderToBuffer } = await import("@react-pdf/renderer");
        const element = renderBoardResolutionTemplate({
          legalMembershipId,
          resolutionId: legalMembershipId,
          resolutionText: lm.boardResolutionText,
          resolutionTextHash: lm.boardResolutionHash,
          subjectName,
          sitzungsleiter: {
            name: sitzungsleiterNames
              ? `${sitzungsleiterNames.firstName} ${sitzungsleiterNames.lastName}`.trim()
              : roles.sitzungsleiter.userId,
            officerFunction: roles.sitzungsleiter.officerFunction,
          },
          protokollfuehrer: {
            name: protokollfuehrerNames
              ? `${protokollfuehrerNames.firstName} ${protokollfuehrerNames.lastName}`.trim()
              : roles.protokollfuehrer.userId,
            officerFunction: roles.protokollfuehrer.officerFunction,
          },
          participants: mappedParticipants,
          votes: mappedVotes,
          renderedAt: new Date(),
        });

        const buffer = Buffer.from(await renderToBuffer(element));

        return archiveLegalDocument({
          legalMembershipId,
          buffer,
          fileName: `board-resolution-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
          firstName: subject.firstName,
          lastName: subject.lastName,
        });
      },
    );

    // Step 9b: Render and archive membership application PDF.
    const { driveFileId: applicationFileDriveId } = await step.run(
      "archive-membership-application",
      async () => {
        const application = await db.query.membershipApplication.findFirst({
          where: (ma, { eq: eqFn }) =>
            eqFn(ma.legalMembershipId, legalMembershipId),
        });

        if (!application) {
          throw new Error(
            `No membership_application found for ${legalMembershipId}`,
          );
        }

        if (application.subjectUserId !== subjectUserId) {
          throw new Error(
            `Ownership mismatch: application subjectUserId ${application.subjectUserId} does not match expected ${subjectUserId} for legal membership ${legalMembershipId}`,
          );
        }

        if (
          !application.street ||
          !application.city ||
          !application.zip ||
          !application.country ||
          !application.birthDate ||
          !application.declarations ||
          !application.feeTextVersion ||
          !application.applicationVersion ||
          !application.submittedAt
        ) {
          throw new Error(
            `Membership application ${application.id} is missing required fields`,
          );
        }

        const renderedAt = new Date();
        const { renderToBuffer } = await import("@react-pdf/renderer");
        const element = renderMembershipApplicationTemplate({
          legalMembershipId,
          applicationId: application.id,
          subjectName,
          email: application.personalEmail ?? undefined,
          birthDate: application.birthDate,
          address: {
            street: application.street,
            city: application.city,
            state: application.state ?? "",
            zip: application.zip,
            country: application.country,
          },
          declarations: application.declarations,
          feeTextVersion: application.feeTextVersion,
          applicationVersion: application.applicationVersion,
          submittedAt: application.submittedAt,
          renderedAt,
        });

        const [
          mainBuffer,
          appendixABuffer,
          appendixBBuffer,
          satzungBuffer,
          finanzordnungBuffer,
        ] = await Promise.all([
          renderToBuffer(element).then((b) => Buffer.from(b)),
          renderToBuffer(
            renderAppendixPage({
              letter: "A",
              title: "Bylaws (Satzung)",
              docId: "ANX-A",
              legalMembershipId,
              renderedAt,
            }),
          ).then((b) => Buffer.from(b)),
          renderToBuffer(
            renderAppendixPage({
              letter: "B",
              title: "Financial Regulations (Finanzordnung)",
              docId: "ANX-B",
              legalMembershipId,
              renderedAt,
            }),
          ).then((b) => Buffer.from(b)),
          readSatzungBuffer(),
          readFinanzordnungBuffer(),
        ]);

        const buffer = await mergePdfsWithAttachments(mainBuffer, [
          {
            title: "Appendix A: Bylaws",
            buffer: satzungBuffer,
            dividerBuffer: appendixABuffer,
          },
          {
            title: "Appendix B: Financial Regulations",
            buffer: finanzordnungBuffer,
            dividerBuffer: appendixBBuffer,
          },
        ]);

        return archiveLegalDocument({
          legalMembershipId,
          buffer,
          fileName: `membership-application-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
          firstName: subject.firstName,
          lastName: subject.lastName,
        });
      },
    );

    // Send the applicant a confirmation email with the application PDF attached.
    await step.run("send-application-submitted-email", async () => {
      if (!subject.email) {
        throw new Error(`Missing email for subject user ${subjectUserId}`);
      }

      const attachments = applicationFileDriveId
        ? [
            {
              filename: `membership-application-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
              content: await downloadArchivedDocument(applicationFileDriveId),
              contentType: "application/pdf",
            },
          ]
        : undefined;

      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subject.email,
        subject: "Your membership application has been received",
        react: MembershipApplicationSubmittedEmail({
          firstName: subject.firstName,
        }),
        attachments,
      });
    });

    // Step 10: Activate the legal membership.
    const activatedAt = await step.run(
      "activate-legal-membership",
      async () => {
        const now = new Date();
        await db.transaction(async (tx) => {
          await tx
            .update(legalMembership)
            .set({ status: "active", activatedAt: now })
            .where(eq(legalMembership.id, legalMembershipId));
          await tx
            .update(user)
            .set({ legalMembershipState: "active_member" })
            .where(eq(user.id, subjectUserId));
          await tx
            .update(user)
            .set({ status: "member" })
            .where(
              and(eq(user.id, subjectUserId), eq(user.status, "onboarding")),
            );
        });

        return now.toISOString();
      },
    );

    await step.sendEvent("user-status-changed", {
      name: events.cockpitUserUpdated.name,
      data: { id: subjectUserId },
    });

    // Kick off the mandate-setup reminder workflow; it self-checks current
    // mandate state at each tick so it's a no-op if the user already has one.
    await step.sendEvent("kick-mandate-setup-reminder", {
      name: events.mandateSetupNeeded.name,
      data: { userId: subjectUserId },
    });

    // Step 9c: Render and archive admission confirmation PDF.
    const { driveFileId: confirmationFileDriveId } = await step.run(
      "archive-admission-confirmation",
      async () => {
        const [lm, application] = await Promise.all([
          db.query.legalMembership.findFirst({
            where: (l, { eq: eqFn }) => eqFn(l.id, legalMembershipId),
            columns: { boardParticipants: true },
          }),
          db.query.membershipApplication.findFirst({
            where: (ma, { eq: eqFn }) =>
              eqFn(ma.legalMembershipId, legalMembershipId),
            columns: { street: true, zip: true, city: true, country: true },
          }),
        ]);

        const participants = lm?.boardParticipants ?? [];
        const participantIds = participants.map((p) => p.userId);

        const participantUsers =
          participantIds.length > 0
            ? await db.query.user.findMany({
                where: (u, { inArray }) => inArray(u.id, participantIds),
                columns: { id: true, firstName: true, lastName: true },
              })
            : [];

        const userNameById = new Map(participantUsers.map((u) => [u.id, u]));

        const board = participants.map((p) => {
          const names = userNameById.get(p.userId);
          return {
            name: names
              ? `${names.firstName} ${names.lastName}`.trim()
              : p.userId,
            role: ROLE_DISPLAY[p.officerFunction] ?? p.officerFunction,
          };
        });

        const subjectAddress = application?.street
          ? [
              application.street,
              `${application.zip} ${application.city}`.trim(),
              application.country,
            ]
              .filter(Boolean)
              .join(" · ")
          : undefined;

        const { renderToBuffer } = await import("@react-pdf/renderer");
        const element = renderAdmissionConfirmationTemplate({
          legalMembershipId,
          subjectName,
          subjectAddress,
          board,
          activatedAt: new Date(activatedAt),
          renderedAt: new Date(),
        });

        const buffer = Buffer.from(await renderToBuffer(element));

        return archiveLegalDocument({
          legalMembershipId,
          buffer,
          fileName: `admission-confirmation-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
          firstName: subject.firstName,
          lastName: subject.lastName,
        });
      },
    );

    // Step 11: Send admission confirmation to the new member.
    await step.run("send-admission-confirmed-email", async () => {
      if (!subject.email) {
        throw new Error(`Missing email for subject user ${subjectUserId}`);
      }

      const freshUser = await db.query.user.findFirst({
        where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
        columns: { status: true, gocardlessMandateId: true },
      });

      const includesPaymentCta =
        freshUser?.status === "member" && !freshUser?.gocardlessMandateId;

      const attachments = confirmationFileDriveId
        ? [
            {
              filename: `admission-confirmation-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
              content: await downloadArchivedDocument(confirmationFileDriveId),
              contentType: "application/pdf",
            },
          ]
        : undefined;

      await sendEmail({
        from: "START Berlin <notifications@cockpit.start-berlin.com>",
        to: subject.email,
        subject: includesPaymentCta
          ? "Finalize your START Berlin membership"
          : "Your START Berlin membership is active",
        react: MembershipAdmissionConfirmedEmail({
          firstName: subject.firstName,
          includesPaymentCta,
          membershipUrl: `${env.NEXT_PUBLIC_COCKPIT_URL}/membership`,
        }),
        attachments,
      });
    });

    // Step 11b: Load board completion notification data.
    const boardCompletionData = await step.run(
      "load-board-completion-data",
      async () => {
        const [positions, subjectUser] = await Promise.all([
          getPositionAssignments(),
          db.query.user.findFirst({
            where: (u, { eq: eqFn }) => eqFn(u.id, subjectUserId),
            columns: { department: true },
          }),
        ]);

        const recipients = getFyiRecipients(
          positions,
          subjectUserId,
          subjectUser?.department,
        );

        const boardMemberIds = new Set(
          [
            positions.president,
            positions.vice_president,
            positions.head_of_finance,
          ].flatMap((p) => (p ? [p.userId] : [])),
        );

        // Non-board recipients can only be the dept head of the subject's
        // department (per getFyiRecipients), so department is non-null here.
        const subjectDepartmentLabel = subjectUser?.department
          ? DEPARTMENT_NAMES[subjectUser.department]
          : null;

        return {
          subjectName,
          participants: recipients.map((r) => ({
            userId: r.userId,
            email: r.email,
            firstName: r.firstName,
            receivingReason: boardMemberIds.has(r.userId)
              ? "You're receiving this because you're a board member of START Berlin."
              : `You're receiving this because you're the department head of ${subjectDepartmentLabel}.`,
          })),
          boardResolutionDriveFileId: boardResolutionFileDriveId,
        };
      },
    );

    // Step 11c: Send one completion email per board participant.
    for (const participant of boardCompletionData.participants) {
      await step.run(
        `send-board-completion-email-${participant.userId}`,
        async () => {
          if (!participant.email) return;
          const attachments = boardCompletionData.boardResolutionDriveFileId
            ? [
                {
                  filename: `board-resolution-${subject.firstName}-${subject.lastName}-${legalMembershipId}.pdf`,
                  content: await downloadArchivedDocument(
                    boardCompletionData.boardResolutionDriveFileId,
                  ),
                  contentType: "application/pdf",
                },
              ]
            : undefined;

          await sendEmail({
            from: "START Berlin <notifications@cockpit.start-berlin.com>",
            to: participant.email,
            subject: `Admission complete: ${boardCompletionData.subjectName} is now a member`,
            react: MembershipAdmissionCompletedBoardEmail({
              firstName: participant.firstName ?? "",
              subjectName: boardCompletionData.subjectName,
              legalMembershipId,
              receivingReason: participant.receivingReason,
            }),
            attachments,
          });
        },
      );
    }

    return { outcome: "activated", legalMembershipId };
  },
);
