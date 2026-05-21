import { redirect } from "next/navigation";
import { can } from "@/lib/permissions/server";

interface AdminGroupsLayoutProps {
  children: React.ReactNode;
}

export default async function AdminGroupsLayout({
  children,
}: AdminGroupsLayoutProps) {
  if (!(await can("groups.view_all"))) {
    redirect("/membership");
  }

  return <>{children}</>;
}
