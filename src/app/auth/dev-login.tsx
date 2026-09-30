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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * DEV-ONLY email login. Posts to the dev-login endpoint, which signs in a
 * pre-existing user with no verification. Rendered on /auth only when
 * ENABLE_DEV_LOGIN is set. See src/lib/auth-dev-login.ts.
 */
export default function DevLogin() {
  const [callbackURL] = useQueryState("redirect");
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    try {
      setIsLoading(true);

      const response = await fetch("/api/auth/sign-in/dev", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        toast.error(
          data?.message ??
            "Could not sign you in. Make sure a user with that email exists.",
        );
        return;
      }

      // Only allow same-origin relative paths to avoid an open redirect.
      // Rejects absolute URLs (https://evil.com) and protocol-relative (//evil.com).
      const safeTarget =
        callbackURL?.startsWith("/") && !callbackURL.startsWith("//")
          ? callbackURL
          : "/";

      // Full navigation so the new session cookie is picked up server-side.
      window.location.href = safeTarget;
    } catch (error) {
      console.error(error);
      toast.error("Could not sign you in. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="border-amber-500">
      <CardHeader>
        <CardTitle>Dev login</CardTitle>
        <CardDescription>
          Sign in as any existing user by email — no password, no verification.
          Local development only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={signIn} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="dev-email">Email</Label>
            <Input
              id="dev-email"
              type="email"
              required
              autoComplete="email"
              placeholder="you@start-berlin.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={isLoading}
            />
          </div>
          <Button type="submit" disabled={isLoading || !email}>
            {isLoading ? (
              <>
                <Loader2Icon className="animate-spin" />
                Please wait
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
