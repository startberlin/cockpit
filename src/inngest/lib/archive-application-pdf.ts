import { archiveLegalDocument } from "@/lib/legal-documents/drive-archive";
import { mergePdfsWithAttachments } from "@/lib/legal-documents/pdf-merge";
import {
  readFinanzordnungBuffer,
  readSatzungBuffer,
} from "@/lib/legal-documents/static-documents";
import { renderAppendixPage } from "@/lib/legal-documents/templates/appendix";
import { renderMembershipApplicationTemplate } from "@/lib/legal-documents/templates/membership-application";

interface ApplicationPdfParams {
  legalMembershipId: string;
  applicationId: string;
  subjectName: string;
  firstName: string;
  lastName: string;
  email?: string;
  birthDate: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  declarations: Record<string, boolean>;
  feeTextVersion: string;
  applicationVersion: string;
  submittedAt: Date;
}

// Renders the membership application PDF (with Satzung + Finanzordnung appendices)
// and archives it to Google Drive. Called from within step.run so the result is
// memoized by Inngest across replays.
export async function archiveMembershipApplicationPdf(
  params: ApplicationPdfParams,
): Promise<{ driveFileId: string | null }> {
  const renderedAt = new Date();
  const { renderToBuffer } = await import("@react-pdf/renderer");

  const element = renderMembershipApplicationTemplate({
    legalMembershipId: params.legalMembershipId,
    applicationId: params.applicationId,
    subjectName: params.subjectName,
    email: params.email,
    birthDate: params.birthDate,
    address: params.address,
    declarations: params.declarations,
    feeTextVersion: params.feeTextVersion,
    applicationVersion: params.applicationVersion,
    submittedAt: params.submittedAt,
    renderedAt,
  });

  const [
    mainBuffer,
    appendixABuffer,
    appendixBBuffer,
    satzungBuffer,
    finanzordnungBuffer,
  ] = await Promise.all([
    renderToBuffer(element).then((b) => Buffer.from(b)),
    renderToBuffer(
      renderAppendixPage({
        letter: "A",
        title: "Bylaws (Satzung)",
        docId: "ANX-A",
        legalMembershipId: params.legalMembershipId,
        renderedAt,
      }),
    ).then((b) => Buffer.from(b)),
    renderToBuffer(
      renderAppendixPage({
        letter: "B",
        title: "Financial Regulations (Finanzordnung)",
        docId: "ANX-B",
        legalMembershipId: params.legalMembershipId,
        renderedAt,
      }),
    ).then((b) => Buffer.from(b)),
    readSatzungBuffer(),
    readFinanzordnungBuffer(),
  ]);

  const buffer = await mergePdfsWithAttachments(mainBuffer, [
    {
      title: "Appendix A: Bylaws",
      buffer: satzungBuffer,
      dividerBuffer: appendixABuffer,
    },
    {
      title: "Appendix B: Financial Regulations",
      buffer: finanzordnungBuffer,
      dividerBuffer: appendixBBuffer,
    },
  ]);

  return archiveLegalDocument({
    legalMembershipId: params.legalMembershipId,
    buffer,
    fileName: `membership-application-${params.firstName}-${params.lastName}-${params.legalMembershipId}.pdf`,
    firstName: params.firstName,
    lastName: params.lastName,
  });
}
