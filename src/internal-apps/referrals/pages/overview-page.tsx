import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createMetadata } from "@/lib/metadata";
import { CopyReferralLink } from "../components/copy-referral-link";
import { getReferralsOverview } from "../db/queries";
import { referralUrl } from "../lib/links";

export const metadata = createMetadata({
  title: "Referral overview",
  description: "Completed applications by referral.",
});

export default async function OverviewPage() {
  const { campaign, members, statuses } = await getReferralsOverview();
  const matched = statuses.find((row) => row.status === "matched")?.count ?? 0;
  const total = statuses.reduce((sum, row) => sum + row.count, 0);
  const formerCount =
    matched - members.reduce((sum, member) => sum + member.applications, 0);
  const diagnosticLabels = {
    missing_code: "Without a code",
    unknown_code: "Unknown code",
    wrong_campaign: "Campaign mismatch",
    outside_window: "Outside application window",
    invalid_fields: "Invalid hidden fields",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black uppercase tracking-tight sm:text-3xl">
          Overview
        </h1>
        {campaign ? (
          <p className="mt-2 text-sm text-muted-foreground">{campaign.name}</p>
        ) : null}
      </div>
      {!campaign ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No application round configured.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-6">
            <Card>
              <CardContent>
                <p className="text-4xl font-black tabular-nums">{matched}</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Referred applications
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <p className="text-4xl font-black tabular-nums">
                  {total - matched}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Unattributed
                </p>
              </CardContent>
            </Card>
          </div>
          <Card className="gap-0 py-0">
            <CardContent className="px-3 sm:px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead className="text-right">Applications</TableHead>
                    <TableHead className="w-12">
                      <span className="sr-only">Referral link</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.code}>
                      <TableCell className="whitespace-normal break-words py-3">
                        {member.name}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {member.applications}
                      </TableCell>
                      <TableCell className="p-0">
                        <CopyReferralLink
                          url={referralUrl(member.code)}
                          name={member.name}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                  {formerCount > 0 ? (
                    <TableRow>
                      <TableCell className="whitespace-normal py-3 text-muted-foreground">
                        Former members
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formerCount}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
              {members.length === 0 ? (
                <p className="py-4 text-sm text-muted-foreground">
                  No active members.
                </p>
              ) : null}
            </CardContent>
          </Card>
          {statuses.some((row) => row.status !== "matched") ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              {statuses
                .filter((row) => row.status !== "matched")
                .map((row) => (
                  <p key={row.status} className="flex justify-between gap-4">
                    <span>
                      {
                        diagnosticLabels[
                          row.status as keyof typeof diagnosticLabels
                        ]
                      }
                    </span>
                    <span className="tabular-nums">{row.count}</span>
                  </p>
                ))}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
