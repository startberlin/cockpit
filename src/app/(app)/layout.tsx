import { headers } from "next/headers";
import Image from "next/image";
import { redirect } from "next/navigation";
import Logo from "@/app/logo-white.png";
import { UserAvatar } from "@/components/user-avatar";
import { auth } from "@/lib/auth";

interface AppLayoutProps {
  children: React.ReactNode;
}

export default async function AppLayout({ children }: AppLayoutProps) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/auth");
  }

  return (
    <div className="flex flex-col">
      <div className="w-full bg-brand">
        <div className="w-full flex flex-col gap-14 max-w-4xl mx-auto py-6 px-6">
          <div className="flex w-full items-center justify-between">
            <Image src={Logo} alt="START Berlin" className="h-8 w-auto" />
            <UserAvatar user={session.user} />
          </div>
          <p className="text-brand-foreground uppercase font-bold text-2xl">
            Hi {session.user.firstName}
          </p>
        </div>
      </div>
      <main className="max-w-4xl w-full mx-auto px-6 py-6">{children}</main>
    </div>
  );
}
