import { redirect } from "next/navigation";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  const authority = await getUserAuthority(user.id);

  if (!authority) {
    return redirect("/auth");
  }

  const hasAdminAccess =
    authority.grants.some((g) =>
      (
        ["admin", "super_admin", "people_admin", "finance_admin"] as const
      ).includes(g.grant),
    ) ||
    authority.positions.some(
      (p) =>
        p.position === "department_head" || p.position === "head_of_finance",
    );

  if (!hasAdminAccess) {
    return redirect("/membership");
  }

  return <>{children}</>;
}
