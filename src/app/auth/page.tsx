import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function SignIn() {
  // Check if user is already authenticated
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // If already authenticated, redirect to home
  if (session) {
    redirect("/");
  }

  // Initiate Google OAuth flow server-side
  const result = await auth.api.signInSocial({
    body: {
      provider: "google",
      callbackURL: "/",
      disableRedirect: true,
    },
  });

  console.log(result);

  if (result && typeof result === "object" && "url" in result && result.url) {
    redirect(result.url as string);
  }

  // This should never be reached, but just in case
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to Google...</p>
      </div>
    </div>
  );
}
