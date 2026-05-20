import { redirect } from "next/navigation";
import { getCurrentUser } from "@/db/user";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    return redirect("/auth");
  }

  return <>{children}</>;
}
