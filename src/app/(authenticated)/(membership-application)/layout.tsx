import { redirect } from "next/navigation";
import type React from "react";
import { getCurrentUser } from "@/db/user";

interface MembershipApplicationLayoutProps {
  children: React.ReactNode;
}

export default async function MembershipApplicationLayout({
  children,
}: MembershipApplicationLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  return <>{children}</>;
}
