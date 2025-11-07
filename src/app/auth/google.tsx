"use client";

import { Loader2Icon } from "lucide-react";
import { useQueryState } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { env } from "@/env";
import { authClient } from "@/lib/auth-client";

export default function Google() {
  const [callbackURL] = useQueryState("redirect");
  const [isLoading, setIsLoading] = useState(false);

  async function signIn() {
    try {
      setIsLoading(true);

      console.log(`URL: ${env.NEXT_PUBLIC_COCKPIT_URL}/auth/error`);

      const result = await authClient.signIn.social({
        provider: "google",
        callbackURL: callbackURL ?? undefined,
      });

      if (!result.error) return;

      toast.error("Failed Google sign in");
    } catch (error) {
      console.error(error);

      toast.error("Failed Google sign in");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Continue with Google</CardTitle>
        <CardDescription>
          Use your START Berlin Google account to continue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isLoading ? (
          <Button onClick={signIn}>Sign in with Google</Button>
        ) : (
          <Button disabled>
            <Loader2Icon className="animate-spin" />
            Please wait
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
