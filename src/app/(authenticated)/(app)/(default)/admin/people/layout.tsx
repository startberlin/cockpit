import { redirect } from "next/navigation";
import { can } from "@/lib/permissions/server";

interface AdminPeopleLayoutProps {
  children: React.ReactNode;
}

export default async function AdminPeopleLayout({
  children,
}: AdminPeopleLayoutProps) {
  if (!(await can("user.view_details"))) {
    redirect("/membership");
  }

  return <>{children}</>;
}
