import "server-only";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function mergePdfsWithAttachments(
  mainPdfBuffer: Buffer,
  attachments: Array<{
    title: string;
    buffer: Buffer;
    dividerBuffer?: Buffer;
  }>,
): Promise<Buffer> {
  const mainDoc = await PDFDocument.load(mainPdfBuffer);

  for (const attachment of attachments) {
    if (attachment.dividerBuffer) {
      const dividerDoc = await PDFDocument.load(attachment.dividerBuffer);
      const [dividerPage] = await mainDoc.copyPages(dividerDoc, [0]);
      mainDoc.addPage(dividerPage);
    } else {
      const dividerDoc = await PDFDocument.create();
      const dividerPage = dividerDoc.addPage();
      const font = await dividerDoc.embedFont(StandardFonts.HelveticaBold);
      const { width, height } = dividerPage.getSize();
      const textWidth = font.widthOfTextAtSize(attachment.title, 16);
      dividerPage.drawText(attachment.title, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: 16,
        font,
        color: rgb(0, 0, 0),
      });
      const [dividerPageCopy] = await mainDoc.copyPages(dividerDoc, [0]);
      mainDoc.addPage(dividerPageCopy);
    }

    const attachmentDoc = await PDFDocument.load(attachment.buffer);
    const copiedPages = await mainDoc.copyPages(
      attachmentDoc,
      attachmentDoc.getPageIndices(),
    );
    for (const page of copiedPages) {
      mainDoc.addPage(page);
    }
  }

  return Buffer.from(await mainDoc.save());
}
