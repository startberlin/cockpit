import "server-only";

import {
  addMonths,
  addYears,
  differenceInYears,
  getDate,
  getMonth,
  getYear,
  parseISO,
} from "date-fns";
import { and, inArray, isNotNull } from "drizzle-orm";
import db from "@/db";
import { user } from "@/db/schema/auth";
import { events, inngest } from "@/lib/inngest";

export const membershipAnniversaryCron = inngest.createFunction(
  {
    id: "membership-anniversary-cron",
    name: "Membership Anniversary Emails (daily)",
    triggers: [{ cron: "TZ=Europe/Berlin 0 3 * * *" }],
  },
  async ({ step }) => {
    const eligibleUsers = await step.run("load-eligible-users", () =>
      db
        .select({
          id: user.id,
          firstName: user.firstName,
          memberSinceDate: user.memberSinceDate,
        })
        .from(user)
        .where(
          and(
            isNotNull(user.memberSinceDate),
            inArray(user.status, ["member", "supporting_alumni"]),
            inArray(user.legalMembershipState, ["active_member"]),
          ),
        ),
    );

    // Cron fires at 3am Berlin (UTC+1/+2), so UTC date matches Berlin date.
    const today = new Date();
    const todayDay = getDate(today);
    const todayMonth = getMonth(today);
    const todayYear = getYear(today);

    type AnniversaryEvent = {
      id: string;
      name: string;
      data: {
        userId: string;
        milestoneMonths: number;
        anniversaryDate: string;
      };
    };

    const anniversaryEvents: AnniversaryEvent[] = [];

    for (const member of eligibleUsers) {
      if (!member.memberSinceDate) continue;

      const memberSince = parseISO(member.memberSinceDate);
      const anniversaryDate = `${todayYear}-${String(todayMonth + 1).padStart(2, "0")}-${String(todayDay).padStart(2, "0")}`;

      // 6-month anniversary
      const sixMonthMark = addMonths(memberSince, 6);
      if (
        getDate(sixMonthMark) === todayDay &&
        getMonth(sixMonthMark) === todayMonth &&
        getYear(sixMonthMark) === todayYear
      ) {
        anniversaryEvents.push({
          id: `anniversary-${member.id}-6m-${anniversaryDate}`,
          name: events.membershipAnniversaryDue.name,
          data: { userId: member.id, milestoneMonths: 6, anniversaryDate },
        });
      }

      // Yearly anniversaries (1 year and beyond)
      const yearsCompleted = differenceInYears(today, memberSince);
      if (yearsCompleted >= 1) {
        const yearlyMark = addYears(memberSince, yearsCompleted);
        if (
          getDate(yearlyMark) === todayDay &&
          getMonth(yearlyMark) === todayMonth &&
          getYear(yearlyMark) === todayYear
        ) {
          anniversaryEvents.push({
            id: `anniversary-${member.id}-${yearsCompleted * 12}m-${anniversaryDate}`,
            name: events.membershipAnniversaryDue.name,
            data: {
              userId: member.id,
              milestoneMonths: yearsCompleted * 12,
              anniversaryDate,
            },
          });
        }
      }
    }

    if (anniversaryEvents.length === 0) {
      return { sent: 0 };
    }

    await step.sendEvent("emit-anniversary-events", anniversaryEvents);

    return { sent: anniversaryEvents.length };
  },
);
