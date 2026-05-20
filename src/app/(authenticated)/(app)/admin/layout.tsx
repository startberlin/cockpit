import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";
import { can } from "@/lib/permissions/server";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const [canViewAll, canManagePayments] = await Promise.all([
    can("users.view_all"),
    can("payments.manage"),
  ]);

  if (!canViewAll && !canManagePayments) {
    return redirect("/membership");
  }

  return <>{children}</>;
}
