// Presupuesto — Generador PDF A4 (jsPDF)
// - Moneda ARS/USD (default ARS)
// - Entrega = efectivo + usado (precio de toma)
// - Total operación = entrega + financiación + gastos adm + transferencia

(function initPresupuestoUI(){
  const $ = (id) => document.getElementById(id);

  // Fecha por defecto (hoy)
  const today = new Date();
  $('fecha').value = today.toISOString().slice(0,10);

  // Mostrar/ocultar crédito
  function syncCredito(){
    const on = $('toma_credito').value === 'si';
    $('bloque_credito').style.display = on ? 'block' : 'none';
  }
  $('toma_credito').addEventListener('change', () => { syncCredito(); actualizarResumen(); });
  syncCredito();

  // Formateo de montos en inputs (blur) + resumen live
  const moneyIds = [
    'precio_venta',
    'entrega_efectivo',
    'usado_toma',
    'credito_total',
    'gastos_adm',
    'transferencia'
  ];

  moneyIds.forEach((id) => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', () => actualizarResumen());
    el.addEventListener('blur', () => {
      const n = parseMoney(el.value);
      el.value = n ? formatMoney(n, $('moneda').value) : '';
      actualizarResumen();
    });
  });
  $('moneda').addEventListener('change', () => {
    // Re-formatea todos los montos al cambiar la moneda
    moneyIds.forEach((id) => {
      const el = $(id);
      if (!el) return;
      const n = parseMoney(el.value);
      el.value = n ? formatMoney(n, $('moneda').value) : '';
    });
    actualizarResumen();
  });

  // Resumen inicial
  actualizarResumen();
})();

function parseMoney(v){
  if (v == null) return 0;
  const s = String(v).trim();
  if (!s) return 0;
  // Acepta $12.990.000, 12.990.000, 12990000, 12,990,000
  const cleaned = s.replace(/[^0-9-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

function formatNumberAR(n){
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n || 0);
}

function formatMoney(n, moneda){
  const sym = moneda === 'USD' ? 'USD ' : '$ ';
  return sym + formatNumberAR(n);
}

function getText(id){
  const el = document.getElementById(id);
  return (el?.value ?? '').toString().trim();
}

function getMoney(id){
  const el = document.getElementById(id);
  return parseMoney(el?.value ?? '');
}

function actualizarResumen(){
  const moneda = getText('moneda') || 'ARS';
  const entregaEfectivo = getMoney('entrega_efectivo');
  const usadoToma = getMoney('usado_toma');
  const entregaTotal = entregaEfectivo + usadoToma;

  const tomaCredito = getText('toma_credito') === 'si';
  const creditoTotal = tomaCredito ? getMoney('credito_total') : 0;

  const gastosAdm = getMoney('gastos_adm');
  const transferencia = getMoney('transferencia');

  const totalOperacion = entregaTotal + creditoTotal + gastosAdm + transferencia;

  const entregaEl = document.getElementById("entrega_total");
  if (entregaEl) entregaEl.textContent = formatMoney(entregaTotal, moneda);

  const lines = [];
  if (entregaTotal > 0) lines.push({ label: 'Entrega', value: entregaTotal });
  if (creditoTotal > 0) lines.push({ label: 'Financiación', value: creditoTotal });
  if (gastosAdm > 0) lines.push({ label: 'Gastos administrativos', value: gastosAdm });
  if (transferencia > 0) lines.push({ label: 'Transferencia', value: transferencia });

  const list = document.getElementById('resumen_lista');
  if (list) {
    list.innerHTML = lines.length
      ? lines.map(l => `<div class="row"><span>${escapeHtml(l.label)}:</span><strong>${escapeHtml(formatMoney(l.value, moneda))}</strong></div>`).join('')
      : `<div class="muted">Completá los montos para ver el desglose.</div>`;
  }

  const totalEl = document.getElementById('resumen_total');
  if (totalEl) totalEl.textContent = formatMoney(totalOperacion, moneda);
}

function escapeHtml(str){
  return String(str).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

async function generarPresupuestoPDF(){
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const moneda = getText('moneda') || 'ARS';
  const fecha = getText('fecha') || new Date().toISOString().slice(0,10);

  // Datos cliente
  const nombre = getText('nombre');
  const telefono = getText('telefono');
  const dni = getText('dni');

  // Vehículo (venta)
  const vModelo = getText('veh_modelo');
  const vAnio = getText('veh_anio');
  const vKm = getText('veh_km');
  const precioVenta = getMoney('precio_venta');

  // Entrega
  const entregaEfectivo = getMoney('entrega_efectivo');
  const uModelo = getText('usado_modelo');
  const uAnio = getText('usado_anio');
  const uKm = getText('usado_km');
  const usadoToma = getMoney('usado_toma');
  const entregaTotal = entregaEfectivo + usadoToma;

  // Crédito
  const tomaCredito = getText('toma_credito') === 'si';
  const creditoTotal = tomaCredito ? getMoney('credito_total') : 0;
  const cuotasCant = tomaCredito ? getText('cuotas_cant') : '';

  // Gastos
  const gastosAdm = getMoney('gastos_adm');
  const transferencia = getMoney('transferencia');

  const totalOperacion = entregaTotal + creditoTotal + gastosAdm + transferencia;

  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 14;

  // Header (logo + nombre + fecha)
  const agencyName = 'Jesús Díaz Automotores';
  const logo = await tryLoadImage('logo.png');
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, 'PNG', margin, y - 6, 14, 14);
    } catch (e) {
      // si falla, seguimos sin logo
    }
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(agencyName, margin + (logo ? 18 : 0), y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Fecha: ${fecha}`, pageW - margin, y, { align: 'right' });
  y += 8;

  // Título
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('PRESUPUESTO', pageW / 2, y + 6, { align: 'center' });
  y += 16;

  const drawSection = (title, lines) => {
    y = ensureSpace(doc, y, 30, margin);
    doc.setDrawColor(229);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(title, margin, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    lines.forEach((l) => {
      y = ensureSpace(doc, y, 12, margin);
      const left = `${l.label}:`;
      doc.text(left, margin, y);
      const valueText = l.value ?? '';
      if (Array.isArray(valueText)) {
        valueText.forEach((t) => {
          y = ensureSpace(doc, y, 10, margin);
          doc.text(String(t), margin + 44, y);
          y += 5;
        });
      } else {
        const wrapped = doc.splitTextToSize(String(valueText), pageW - margin * 2 - 44);
        doc.text(wrapped, margin + 44, y);
        y += 5 * wrapped.length;
      }
    });
    y += 4;
  };

  // Cliente
  drawSection('Datos del cliente', [
    { label: 'Nombre', value: nombre || '—' },
    { label: 'Teléfono', value: telefono || '—' },
    { label: 'DNI', value: dni || '—' },
  ]);

  // Vehículo
  drawSection('Vehículo', [
    { label: 'Modelo', value: vModelo || '—' },
    { label: 'Año', value: vAnio || '—' },
    { label: 'KM', value: vKm || '—' },
    { label: 'Valor de venta', value: precioVenta ? formatMoney(precioVenta, moneda) : '—' },
  ]);

  // Entrega (solo si hay algo cargado)
  const entregaLines = [];
  if (entregaEfectivo > 0) entregaLines.push({ label: 'Efectivo', value: formatMoney(entregaEfectivo, moneda) });
  const usadoTieneDatos = (uModelo || uAnio || uKm || usadoToma > 0);
  if (usadoTieneDatos) {
    const usedDetails = [];
    if (uModelo) usedDetails.push(`Modelo: ${uModelo}`);
    if (uAnio) usedDetails.push(`Año: ${uAnio}`);
    if (uKm) usedDetails.push(`KM: ${uKm}`);
    if (usadoToma > 0) usedDetails.push(`Precio de toma: ${formatMoney(usadoToma, moneda)}`);
    entregaLines.push({ label: 'Vehículo usado (toma)', value: usedDetails.length ? usedDetails : ['—'] });
  }
  if (entregaLines.length) {
    entregaLines.push({ label: 'Entrega total', value: formatMoney(entregaTotal, moneda) });
    drawSection('Entrega', entregaLines);
  }

  // Crédito
  if (tomaCredito) {
    const creditoLines = [
      { label: 'Total del crédito', value: creditoTotal ? formatMoney(creditoTotal, moneda) : '—' },
      { label: 'Cantidad de cuotas', value: cuotasCant || '—' },
    ];
    drawSection('Financiación', creditoLines);
  }

  // Gastos
  drawSection('Gastos', [
    { label: 'Gastos administrativos', value: gastosAdm ? formatMoney(gastosAdm, moneda) : '—' },
    { label: 'Transferencia', value: transferencia ? formatMoney(transferencia, moneda) : '—' },
  ]);

  // Resumen
  const resumen = [];
  if (entregaTotal > 0) resumen.push(['Entrega', entregaTotal]);
  if (creditoTotal > 0) resumen.push(['Financiación', creditoTotal]);
  if (gastosAdm > 0) resumen.push(['Gastos administrativos', gastosAdm]);
  if (transferencia > 0) resumen.push(['Transferencia', transferencia]);

  y = ensureSpace(doc, y, 45, margin);
  doc.setDrawColor(17);
  doc.setLineWidth(0.6);
  doc.roundedRect(margin, y, pageW - margin * 2, 40, 3, 3);
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Resumen de operación', margin + 4, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  resumen.forEach(([label, val]) => {
    doc.text(`${label}:`, margin + 4, y);
    doc.setFont('helvetica', 'bold');
    doc.text(formatMoney(val, moneda), pageW - margin - 4, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 6;
  });
  doc.setDrawColor(229);
  doc.setLineWidth(0.3);
  doc.line(margin + 4, y, pageW - margin - 4, y);
  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('TOTAL OPERACIÓN:', margin + 4, y);
  doc.text(formatMoney(totalOperacion, moneda), pageW - margin - 4, y, { align: 'right' });

  const fileDate = fecha.replaceAll('-', '');
  const safeName = (nombre || 'cliente').replace(/[^a-z0-9áéíóúñ _-]/gi, '').trim().slice(0, 32) || 'cliente';
  doc.save(`Presupuesto_${safeName}_${fileDate}.pdf`);
}

function ensureSpace(doc, y, needed, margin){
  const pageH = doc.internal.pageSize.getHeight();
  if (y + needed > pageH - margin) {
    doc.addPage();
    return margin;
  }
  return y;
}

function tryLoadImage(src){
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl });
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
