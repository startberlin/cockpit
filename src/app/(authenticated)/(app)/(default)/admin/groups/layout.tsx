import { redirect } from "next/navigation";
import { can } from "@/lib/permissions/server";

interface AdminGroupsLayoutProps {
  children: React.ReactNode;
}

export default async function AdminGroupsLayout({
  children,
}: AdminGroupsLayoutProps) {
  if (
    !(await can("group.members.manage")) &&
    !(await can("group.managers.manage")) &&
    !(await can("group.export"))
  ) {
    redirect("/membership");
  }

  return <>{children}</>;
}
