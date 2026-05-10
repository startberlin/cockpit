import { PageSection } from "@/components/page-section";
import PeopleSubNav from "@/components/people-sub-nav";

export default function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="px-6 pt-6">
        <PeopleSubNav />
      </div>
      <PageSection>{children}</PageSection>
    </>
  );
}
