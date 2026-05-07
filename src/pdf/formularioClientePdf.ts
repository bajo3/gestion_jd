import { createPdf, loadImageDataUrl, sanitizeFileName } from "./common";

function normalizeImageForPdf(image: HTMLImageElement) {
  const maxDimension = 1800;
  const width = image.naturalWidth || image.width || maxDimension;
  const height = image.naturalHeight || image.height || maxDimension;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  context?.drawImage(image, 0, 0, targetWidth, targetHeight);
  return canvas.toDataURL("image/jpeg", 0.9);
}

async function fileToNormalizedImage(file?: File | null) {
  if (!file) return null;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return await new Promise<{ dataUrl: string; name: string }>((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        dataUrl: normalizeImageForPdf(image),
        name: file.name,
      });
    image.onerror = reject;
    image.src = dataUrl;
  });
}

export async function generateFormularioClientePdf(payload: {
  dni: string;
  cuil: string;
  situacionLaboral: string;
  dniFrente?: File | null;
  dniDorso?: File | null;
}) {
  const doc = createPdf({ orientation: "portrait", unit: "mm", format: "a4" });
  const logoDataUrl = await loadImageDataUrl("/logo-jd-negro.png");
  const [frenteImage, dorsoImage] = await Promise.all([
    fileToNormalizedImage(payload.dniFrente),
    fileToNormalizedImage(payload.dniDorso),
  ]);

  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let y = 16;

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, y - 3, 24, 10);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("FORMULARIO CLIENTE", pageWidth / 2, y + 2, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Documentacion para gestion administrativa", pageWidth / 2, y + 8, { align: "center" });
  doc.text(
    `Fecha de generacion: ${new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date())}`,
    pageWidth / 2,
    y + 14,
    { align: "center" },
  );
  y += 23;

  const sectionTitle = (title: string) => {
    doc.setFillColor(240, 244, 248);
    doc.roundedRect(margin, y, contentWidth, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(title, margin + 3, y + 5.5);
    y += 12;
  };

  const detailRow = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(value || "-", margin + 32, y);
    doc.setDrawColor(210, 210, 210);
    doc.line(margin, y + 3.5, margin + contentWidth, y + 3.5);
    y += 8;
  };

  sectionTitle("DATOS BASICOS");
  detailRow("DNI", payload.dni);
  detailRow("CUIL", payload.cuil);
  detailRow("Situacion laboral", payload.situacionLaboral);

  sectionTitle("DOCUMENTACION ADJUNTA");
  const cards = [
    { title: "DNI frente", image: frenteImage },
    { title: "DNI dorso", image: dorsoImage },
  ];

  const cardGap = 6;
  const cardWidth = (contentWidth - cardGap) / 2;
  const cardHeight = 78;

  cards.forEach((card, index) => {
    const x = margin + index * (cardWidth + cardGap);
    doc.setDrawColor(210, 210, 210);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(card.title, x + 4, y + 7);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.text(card.image?.name || "No adjuntado", x + 4, y + 13);

    if (card.image) {
      doc.addImage(card.image.dataUrl, "JPEG", x + 4, y + 16, cardWidth - 8, cardHeight - 20);
    } else {
      doc.text("Sin imagen", x + 4, y + 30);
    }
  });
  y += cardHeight + 8;

  if (y > pageHeight - 15) {
    doc.addPage();
  }

  doc.save(`formulario_cliente_${sanitizeFileName(payload.dni || "sin_dni")}.pdf`);
}
