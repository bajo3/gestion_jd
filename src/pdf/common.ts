import { jsPDF } from "jspdf";

const JD_LOGO_RATIO = 749 / 217;

export function createPdf(options?: unknown) {
  return new jsPDF(options as never);
}

export async function loadImageDataUrl(url: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const blob = await response.blob();

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function sanitizeFileName(value: string, fallback = "documento") {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase();

  return normalized || fallback;
}

export function drawPdfLogo(doc: jsPDF, logo: string | null, x: number, y: number, width = 42) {
  if (!logo) return 0;

  const height = width / JD_LOGO_RATIO;
  doc.addImage(logo, "PNG", x, y, width, height);
  return height;
}
