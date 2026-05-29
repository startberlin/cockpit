import "server-only";

import db from "@/db";
import MembershipAnniversary1YearEmail from "@/emails/membership/anniversary/membership-anniversary-1-year";
import MembershipAnniversary6MonthsEmail from "@/emails/membership/anniversary/membership-anniversary-6-months";
import MembershipAnniversaryYearsEmail from "@/emails/membership/anniversary/membership-anniversary-years";
import { sendEmail } from "@/lib/email";
import { events, inngest } from "@/lib/inngest";

export const membershipAnniversaryWorkflow = inngest.createFunction(
  {
    id: "membership-anniversary-workflow",
    name: "Membership Anniversary Email",
    triggers: [{ event: events.membershipAnniversaryDue.name }],
  },
  async ({ event, step }) => {
    const { userId, milestoneMonths } = event.data;

    const member = await step.run("load-member", () =>
      db.query.user.findFirst({
        where: (u, { eq }) => eq(u.id, userId),
        columns: {
          firstName: true,
          email: true,
          status: true,
          legalMembershipState: true,
        },
      }),
    );

    const email = member?.email;
    if (!email) {
      return { outcome: "skipped", reason: "no_email" };
    }

    const isEligible =
      (member.status === "member" || member.status === "supporting_alumni") &&
      member.legalMembershipState === "active_member";

    if (!isEligible) {
      return { outcome: "skipped", reason: "ineligible" };
    }

    await step.run("send-anniversary-email", async () => {
      const from =
        "START Berlin <no-reply@notification.cockpit.start-berlin.com>";

      if (milestoneMonths === 6) {
        await sendEmail({
          from,
          to: email,
          subject: "6 months at START Berlin",
          react: MembershipAnniversary6MonthsEmail({
            firstName: member.firstName,
          }),
          userId,
          emailType: "membership_anniversary_6_months",
        });
        return;
      }

      const years = milestoneMonths / 12;

      if (years === 1) {
        await sendEmail({
          from,
          to: email,
          subject: "1 year at START Berlin",
          react: MembershipAnniversary1YearEmail({
            firstName: member.firstName,
          }),
          userId,
          emailType: "membership_anniversary_1_year",
        });
        return;
      }

      await sendEmail({
        from,
        to: email,
        subject: `${years} years at START Berlin`,
        react: MembershipAnniversaryYearsEmail({
          firstName: member.firstName,
          years,
        }),
        userId,
        emailType: "membership_anniversary_years",
      });
    });

    return { outcome: "sent", milestoneMonths };
  },
);
