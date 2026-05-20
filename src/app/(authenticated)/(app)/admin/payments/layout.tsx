import { redirect } from "next/navigation";
import { can } from "@/lib/permissions/server";

interface AdminPaymentsLayoutProps {
  children: React.ReactNode;
}

export default async function AdminPaymentsLayout({
  children,
}: AdminPaymentsLayoutProps) {
  if (!(await can("payments.manage"))) {
    redirect("/membership");
  }

  return <>{children}</>;
}
