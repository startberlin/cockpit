import Image from "next/image";
import { redirect } from "next/navigation";
import Logo from "@/app/logo-white.png";
import Navigation from "@/components/navigation";
import { UserAvatar } from "@/components/user-avatar";
import { getCurrentUser } from "@/db/user";
import { getOnboardingProgress } from "@/schema/onboarding-progress";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const onboardingStatus = getOnboardingProgress(user);

  if (onboardingStatus !== "completed") {
    return redirect("/onboarding");
  }

  return (
    <div className="flex flex-col">
      <div className="w-full bg-brand">
        <div className="w-full flex flex-col gap-14 max-w-4xl mx-auto pt-6 px-6">
          <div className="flex w-full items-center justify-between">
            <Image src={Logo} alt="START Berlin" className="h-8 w-auto" />
            <UserAvatar user={user} />
          </div>
          <span className="flex flex-col gap-8">
            <p className="text-brand-foreground uppercase font-bold text-2xl">
              Hi {user.firstName}
            </p>
            <Navigation />
          </span>
        </div>
      </div>
      <main className="max-w-4xl w-full mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
