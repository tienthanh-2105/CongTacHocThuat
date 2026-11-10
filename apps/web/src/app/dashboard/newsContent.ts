export function parseArticleContent(raw: string): {
  text: string;
  pdfData?: string;
  pdfName?: string;
  pdfSize?: number;
  image?: string;
  seminarSection?: string;
} {
  if (!raw) return { text: "" };
  const trimmed = raw.trim();
  if (trimmed.startsWith("{") && (trimmed.includes('"pdfData"') || trimmed.includes('"image"') || trimmed.includes('"isPdf"'))) {
    try {
      const obj = JSON.parse(trimmed);
      return {
        text: obj.text || "",
        pdfData: obj.pdfData,
        pdfName: obj.pdfName || "tai-lieu.pdf",
        pdfSize: obj.pdfSize,
        image: obj.image,
        seminarSection: typeof obj.seminarSection === "string" ? obj.seminarSection : undefined,
      };
    } catch {
      // Older articles can contain plain text.
    }
  }
  return { text: raw };
}
