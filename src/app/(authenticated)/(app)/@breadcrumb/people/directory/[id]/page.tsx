import { BreadcrumbView } from "@/components/breadcrumb-view";
import { getUserById } from "@/db/people";

interface BreadcrumbProps {
  params: Promise<{ id: string }>;
}

export default async function MemberBreadcrumb({ params }: BreadcrumbProps) {
  const { id } = await params;
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
