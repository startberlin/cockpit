import { headers } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createLoader, parseAsString } from "nuqs/server";
import { toast } from "sonner";
import Logo from "@/app/logo.png";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { authClient } from "@/lib/auth-client";
import Google from "./google";

export default async function SignIn() {
  // Check if user is already authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If already authenticated, redirect to home
  if (session) {
    redirect("/");
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col justify-center px-4 py-10 lg:px-6">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center space-x-2.5">
          <Image src={Logo} alt="START Berlin" className="h-7 w-auto" />
        </div>
        <h3 className="mt-6 uppercase text-lg font-semibold tracking-wide">
          Welcome to START Berlin
        </h3>
        <Google />
      </div>
    </div>
  );
}
