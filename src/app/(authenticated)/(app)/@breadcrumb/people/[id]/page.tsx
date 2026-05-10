import { BreadcrumbView } from "@/components/breadcrumb-view";
import { NavBreadcrumb } from "@/components/nav-breadcrumb";
import { getUserById } from "@/db/people";

// Sub-route literals under /people that share the same dynamic segment slot.
// When the segment matches one of these, the main route is the listing page —
// fall back to the default breadcrumb.
const STATIC_SUB_ROUTES = new Set(["directory", "batches", "resolutions"]);

interface BreadcrumbProps {
  params: Promise<{ id: string }>;
}

export default async function MemberBreadcrumb({ params }: BreadcrumbProps) {
  const { id } = await params;

  if (STATIC_SUB_ROUTES.has(id)) {
    return <NavBreadcrumb />;
  }

  const user = await getUserById(id);
  const label = user ? `${user.firstName} ${user.lastName}` : "Member";

  return (
    <BreadcrumbView
      crumbs={[
        { label: "People", href: "/people/directory" },
        { label: "Directory", href: "/people/directory" },
        { label },
      ]}
    />
  );
}
