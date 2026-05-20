import { redirect } from "next/navigation";
import { getUserAuthority } from "@/db/authority";
import { getCurrentUser } from "@/db/user";
import { canAccessAnyAdminRoute } from "@/lib/permissions/nav-access";

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

  if (!canAccessAnyAdminRoute(authority)) {
    return redirect("/membership");
  }

  return <>{children}</>;
}
