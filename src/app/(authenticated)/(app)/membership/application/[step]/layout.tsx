import { PageSection } from "@/components/page-section";

export default function ApplicationStepLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageSection>
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Membership Application</h1>
        {children}
      </div>
    </PageSection>
  );
}
