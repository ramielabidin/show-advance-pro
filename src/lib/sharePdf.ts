import type jsPDF from "jspdf";

// Hands the PDF to the OS share sheet when the browser supports sharing files
// (mobile Safari/Chrome), otherwise falls back to a normal download.
//
// Why: jsPDF's `doc.save()` on iOS Safari opens the PDF in a new tab via a
// `blob:` URL. If the user then taps Share → Mail from that tab, Mail picks
// up the blob URL as a link in the email body — recipients hit a 404 because
// blob URLs are scoped to the originating document. Sharing the file directly
// attaches the actual PDF instead.
export async function shareOrDownloadPdf(
  doc: jsPDF,
  filename: string,
  shareTitle?: string,
): Promise<"shared" | "downloaded"> {
  const blob = doc.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
    share?: (data: { files: File[]; title?: string }) => Promise<void>;
  };

  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: shareTitle ?? filename });
      return "shared";
    } catch (err) {
      // User dismissed the share sheet — treat as no-op rather than falling
      // back to a download they didn't ask for.
      if (err instanceof DOMException && err.name === "AbortError") {
        return "shared";
      }
      // Any other error: fall through to download.
    }
  }

  doc.save(filename);
  return "downloaded";
}
