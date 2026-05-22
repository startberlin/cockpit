import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface MembershipOptionsProps {
  hasActiveLegalMembership: boolean;
}

export function MembershipOptions({
  hasActiveLegalMembership,
}: MembershipOptionsProps) {
  return (
    <div className="flex flex-col gap-6">
      <span className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Membership options</h2>
        <p className="text-sm text-muted-foreground">
          Changes to your membership status require approval from your
          department head.
        </p>
      </span>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Card>
          <CardHeader className="gap-2 mb-auto">
            <CardTitle>Become an alumni</CardTitle>
            <CardDescription>
              After one year of active contribution, you can become a START
              Berlin alumni.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button variant="outline" size="sm" asChild>
              <Link href="/membership/become-alumni">
                Request alumni status
              </Link>
            </Button>
          </CardFooter>
        </Card>
        {hasActiveLegalMembership && (
          <Card>
            <CardHeader className="gap-2 mb-auto">
              <CardTitle>Cancel your membership</CardTitle>
              <CardDescription>
                Leave START Berlin e.V. and end your membership.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Button variant="outline" size="sm" asChild>
                <Link href="/membership/cancel">Cancel membership</Link>
              </Button>
            </CardFooter>
          </Card>
        )}
      </div>
    </div>
  );
}
