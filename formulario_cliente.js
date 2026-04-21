(function initFormularioCliente() {
  bindImagePreview("dni_frente");
  bindImagePreview("dni_dorso");
})();

function getValue(id) {
  return (document.getElementById(id)?.value || "").trim();
}

function getSelectedLaborSituation() {
  const selected = document.querySelector('input[name="situacion_laboral"]:checked');
  return selected ? selected.value : "";
}

function readImageFile(inputId) {
  return new Promise((resolve, reject) => {
    const input = document.getElementById(inputId);
    const file = input?.files?.[0];

    if (!file) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        const normalized = normalizeImageForPdf(image);
        resolve({
          dataUrl: normalized.dataUrl,
          name: file.name,
          width: normalized.width,
          height: normalized.height
        });
      };
      image.onerror = () => reject(new Error(`No se pudo procesar la imagen ${file.name}.`));
      image.src = reader.result;
    };
    reader.onerror = () => reject(new Error(`No se pudo leer el archivo ${file.name}.`));
    reader.readAsDataURL(file);
  });
}

function drawImageContain(doc, dataUrl, x, y, maxW, maxH) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || maxW;
      const height = image.naturalHeight || maxH;
      const scale = Math.min(maxW / width, maxH / height);
      const drawW = width * scale;
      const drawH = height * scale;
      const drawX = x + (maxW - drawW) / 2;
      const drawY = y + (maxH - drawH) / 2;
      const format = getImageFormat(dataUrl);

      doc.addImage(dataUrl, format, drawX, drawY, drawW, drawH);

      resolve({
        width: drawW,
        height: drawH,
        x: drawX,
        y: drawY
      });
    };
    image.onerror = () => reject(new Error("No se pudo dibujar una de las imagenes en el PDF."));
    image.src = dataUrl;
  });
}

async function generarFormularioClientePDF() {
  const dni = getValue("dni");
  const cuil = getValue("cuil");
  const situacionLaboral = getSelectedLaborSituation();

  if (!dni) {
    alert("Ingresa el DNI antes de generar el PDF.");
    return;
  }

  if (!cuil) {
    alert("Ingresa el CUIL antes de generar el PDF.");
    return;
  }

  if (!situacionLaboral) {
    alert("Selecciona la situacion laboral antes de generar el PDF.");
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentWidth = pageWidth - margin * 2;

    const [logoDataUrl, frenteImage, dorsoImage] = await Promise.all([
      loadLogoDataUrl(),
      readImageFile("dni_frente"),
      readImageFile("dni_dorso")
    ]);

    const generatedAt = formatDateTime(new Date());
    let y = 18;

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, "PNG", margin, y - 4, 28, 12);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(17);
    doc.text("FORMULARIO CLIENTE", pageWidth / 2, y + 3, { align: "center" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.text("Documentacion para gestion administrativa", pageWidth / 2, y + 10, { align: "center" });
    doc.text(`Fecha de generacion: ${generatedAt}`, pageWidth / 2, y + 16, { align: "center" });
    y += 28;

    y = drawSectionTitle(doc, "DATOS BASICOS", margin, contentWidth, y);
    y = drawDetailRow(doc, "DNI", dni, margin, y, contentWidth);
    y = drawDetailRow(doc, "CUIL", cuil, margin, y, contentWidth);
    y = drawDetailRow(doc, "Situacion laboral", situacionLaboral, margin, y, contentWidth);

    y += 4;
    y = drawSectionTitle(doc, "DOCUMENTACION ADJUNTA", margin, contentWidth, y);

    const imageSections = [
      { title: "DNI frente", image: frenteImage },
      { title: "DNI dorso", image: dorsoImage }
    ];

    for (const section of imageSections) {
      const estimatedHeight = section.image ? 92 : 30;
      if (y + estimatedHeight > pageHeight - 18) {
        doc.addPage();
        y = 18;
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(section.title, margin, y);
      y += 4;

      doc.setDrawColor(210, 210, 210);
      doc.setFillColor(250, 250, 250);

      if (!section.image) {
        doc.roundedRect(margin, y, contentWidth, 18, 3, 3, "FD");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("No adjuntado", margin + 4, y + 11);
        y += 26;
        continue;
      }

      const boxHeight = 82;
      doc.roundedRect(margin, y, contentWidth, boxHeight, 3, 3, "FD");
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.text(`Archivo: ${section.image.name}`, margin + 4, y + 7);

      await drawImageContain(doc, section.image.dataUrl, margin + 4, y + 11, contentWidth - 8, boxHeight - 16);
      y += boxHeight + 10;
    }

    const fileName = `formulario_cliente_${sanitizeDniFileName(dni)}.pdf`;
    doc.save(fileName);
  } catch (error) {
    console.error(error);
    alert("Ocurrio un error al generar el PDF. Revisa las imagenes cargadas e intenta nuevamente.");
  }
}

function bindImagePreview(inputId) {
  const input = document.getElementById(inputId);
  const image = document.getElementById(`${inputId}_preview`);
  const fileName = document.getElementById(`${inputId}_file`);
  const empty = document.getElementById(`${inputId}_empty`);

  if (!input || !image || !fileName || !empty) {
    return;
  }

  input.addEventListener("change", () => {
    const file = input.files?.[0];

    if (!file) {
      image.removeAttribute("src");
      image.style.display = "none";
      empty.style.display = "flex";
      fileName.textContent = "Sin archivo seleccionado";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      image.src = reader.result;
      image.style.display = "block";
      empty.style.display = "none";
      fileName.textContent = file.name;
    };
    reader.onerror = () => {
      image.removeAttribute("src");
      image.style.display = "none";
      empty.style.display = "flex";
      fileName.textContent = "No se pudo cargar la vista previa";
    };
    reader.readAsDataURL(file);
  });
}

function drawSectionTitle(doc, title, x, width, y) {
  doc.setFillColor(240, 244, 248);
  doc.roundedRect(x, y, width, 10, 2, 2, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11.5);
  doc.text(title, x + 3, y + 6.5);
  return y + 16;
}

function drawDetailRow(doc, label, value, x, y, width) {
  const lineY = y + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(`${label}:`, x, y);

  doc.setFont("helvetica", "normal");
  doc.text(value || "-", x + 32, y);
  doc.setDrawColor(210, 210, 210);
  doc.line(x, lineY, x + width, lineY);

  return y + 11;
}

async function loadLogoDataUrl() {
  try {
    const response = await fetch("logo.png");
    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    return null;
  }
}

function formatDateTime(date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function sanitizeDniFileName(dni) {
  const clean = String(dni || "").replace(/\D/g, "");
  return clean || "sin_dni";
}

function normalizeImageForPdf(image) {
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
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return {
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
    width: targetWidth,
    height: targetHeight
  };
}

function getImageFormat(dataUrl) {
  if (typeof dataUrl !== "string") {
    return "JPEG";
  }

  return "JPEG";
}
