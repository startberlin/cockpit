import { BreadcrumbCrumb } from "@/components/breadcrumb-bridge";
import AdminGroupDetailSkeleton from "./skeleton";

export default function AdminGroupDetailLoading() {
  return (
    <>
      <BreadcrumbCrumb
        crumbs={[
          { label: "Admin", href: "/admin" },
          { label: "All groups", href: "/admin/groups" },
          { label: "", skeleton: true },
        ]}
      />
      <AdminGroupDetailSkeleton />
    </>
  );
}
