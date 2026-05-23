import Image from "next/image";
import { createLoader, parseAsString } from "nuqs/server";
import Logo from "@/app/logo-black.png";
import { Button } from "@/components/ui/button";
import { createMetadata } from "@/lib/metadata";
import { grantMaintenanceBypassAction } from "./actions";
import { isMaintenanceAdmin } from "./eligibility";

export const metadata = createMetadata({
  title: "Maintenance",
  description: "Cockpit is temporarily unavailable.",
});

const loadSearchParams = createLoader({ redirect: parseAsString });

interface PageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function MaintenancePage({ searchParams }: PageProps) {
  const { redirect } = await loadSearchParams(searchParams);
  const eligible = await isMaintenanceAdmin();

  return (
    <div className="flex min-h-screen flex-1 flex-col md:justify-center px-6 md:px-4 py-6 md:py-10 lg:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center space-x-2.5">
          <Image src={Logo} alt="START Berlin" className="h-7 w-auto" />
        </div>
        <h3 className="mt-6 uppercase text-lg font-semibold tracking-wide">
          START Cockpit is temporarily unavailable
        </h3>
        <p className="mt-3 text-sm text-muted-foreground">
          We're currently performing maintenance. Please check back shortly.
        </p>
        {eligible ? (
          <form action={grantMaintenanceBypassAction} className="mt-6">
            <input type="hidden" name="redirect" value={redirect ?? "/"} />
            <Button type="submit">Skip as admin (30 minutes)</Button>
          </form>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            If you have questions, reach out on Slack.
          </p>
        )}
      </div>
    </div>
  );
}
