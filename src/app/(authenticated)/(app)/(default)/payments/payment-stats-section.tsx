import { InfoIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getPaymentStats } from "@/db/membership-payments";

function formatAmount(amountCents: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amountCents / 100);
}

export default async function PaymentStatsSection() {
  const stats = await getPaymentStats();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-6 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
          <CardDescription>Proposed</CardDescription>
          <CardTitle className="text-3xl font-bold tabular-nums">
            {stats.proposedCount}
          </CardTitle>
          <CardAction className="max-sm:[grid-area:auto] max-sm:justify-self-start">
            <Badge variant="outline">
              {formatAmount(stats.proposedAmount)}
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
          <CardDescription>Processing</CardDescription>
          <CardTitle className="text-3xl font-bold tabular-nums">
            {stats.inFlightCount}
          </CardTitle>
          <CardAction className="max-sm:[grid-area:auto] max-sm:justify-self-start">
            <Badge variant="outline">
              {formatAmount(stats.inFlightAmount)}
            </Badge>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
          <CardDescription>Confirmed</CardDescription>
          <CardTitle className="text-3xl font-bold tabular-nums">
            {formatAmount(stats.confirmedAmount)}
          </CardTitle>
          <CardDescription className="text-xs sm:hidden">
            Payout confirmed
          </CardDescription>
          <CardAction className="max-sm:hidden">
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="size-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Payments confirmed by the member's bank that will be received
                  soon.
                </p>
              </TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
      </Card>
      <Card>
        <CardHeader className="max-sm:has-data-[slot=card-action]:grid-cols-1">
          <CardDescription>Collected</CardDescription>
          <CardTitle className="text-3xl font-bold tabular-nums">
            {formatAmount(stats.collectedAmount)}
          </CardTitle>
          <CardDescription className="text-xs sm:hidden">
            Payments collected within the last 365 days.
          </CardDescription>
          <CardAction className="max-sm:hidden">
            <Tooltip>
              <TooltipTrigger>
                <InfoIcon className="size-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Payments collected within the last 365 days.</p>
              </TooltipContent>
            </Tooltip>
          </CardAction>
        </CardHeader>
      </Card>
    </div>
  );
}
