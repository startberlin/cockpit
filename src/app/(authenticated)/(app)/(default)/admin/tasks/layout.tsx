import { redirect } from "next/navigation";
import { can } from "@/lib/permissions/server";

export default async function AdminTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await can("tasks.view_any"))) {
    redirect("/membership");
  }
  return <>{children}</>;
}
