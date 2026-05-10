import { PageSection } from "@/components/page-section";
import PeopleSubNav from "@/components/people-sub-nav";

export default function PeopleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Option A: brand-colored sub-nav strip, edge-to-edge within max-w-4xl */}
      <div className="w-full bg-brand px-6">
        <PeopleSubNav />
      </div>
      <PageSection>{children}</PageSection>
    </>
  );
}
