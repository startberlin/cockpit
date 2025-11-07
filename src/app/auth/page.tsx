import Image from "next/image";
import { redirect } from "next/navigation";
import { createLoader, parseAsString } from "nuqs/server";
import Logo from "@/app/logo-black.png";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentUser } from "@/db/user";
import { createMetadata } from "@/lib/metadata";
import Google from "./google";

export const metadata = createMetadata({
  title: "Cockpit",
  description: "Manage your membership, get access to software and more.",
});

function ErrorCard({ error }: { error: string }) {
  if (error === "unable_to_create_user") {
    return (
      <Card className="border-red-500">
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
          <CardDescription>
            An admin first needs to enable your account before you can use START
            Cockpit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            Message{" "}
            <a href="mailto:operations@start-berlin.com" className="underline">
              operations@start-berlin.com
            </a>{" "}
            for help.
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-red-500">
      <CardHeader>
        <CardTitle>Error</CardTitle>
        <CardDescription>
          There was an error signing in. Please try again.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

const loadSearchParams = createLoader({ error: parseAsString });

interface PageProps {
  searchParams: Promise<{ error: string | undefined }>;
}

export default async function SignIn({ searchParams }: PageProps) {
  const { error } = await loadSearchParams(searchParams);

  const user = await getCurrentUser();

  if (user) {
    return redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col md:justify-center px-6 md:px-4 py-6 md:py-10 lg:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center space-x-2.5">
          <Image src={Logo} alt="START Berlin" className="h-7 w-auto" />
        </div>
        <h3 className="mt-6 uppercase text-lg font-semibold tracking-wide">
          Welcome to START Berlin
        </h3>
        <span className="flex flex-col mt-6 gap-3">
          {error && <ErrorCard error={error} />}
          <Google />
        </span>
      </div>
    </div>
  );
}
