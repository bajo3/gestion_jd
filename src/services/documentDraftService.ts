export type DocumentType =
  | "compraVenta"
  | "autorizacion"
  | "datero"
  | "recibo"
  | "presupuesto"
  | "testDrive"
  | "formularioCliente";

const DRAFT_PREFIX = "gestion-jd-document-draft";

export const documentRoutes: Record<DocumentType, string> = {
  compraVenta: "/compra-venta",
  autorizacion: "/autorizacion-conduccion",
  datero: "/datero",
  recibo: "/recibo",
  presupuesto: "/presupuesto",
  testDrive: "/test-drive",
  formularioCliente: "/formulario-cliente",
};

export const documentLabels: Record<DocumentType, string> = {
  compraVenta: "Compra y Venta",
  autorizacion: "Autorizacion",
  datero: "Datero",
  recibo: "Recibo",
  presupuesto: "Presupuesto",
  testDrive: "Test Drive",
  formularioCliente: "Formulario Cliente",
};

function keyFor(documentType: DocumentType) {
  return `${DRAFT_PREFIX}:${documentType}`;
}

export function saveDocumentDraft<T extends Record<string, unknown>>(documentType: DocumentType, values: Partial<T>) {
  localStorage.setItem(
    keyFor(documentType),
    JSON.stringify({
      values,
      createdAt: new Date().toISOString(),
    }),
  );
}

export function consumeDocumentDraft<T extends Record<string, unknown>>(documentType: DocumentType) {
  const key = keyFor(documentType);
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  localStorage.removeItem(key);

  try {
    const parsed = JSON.parse(raw) as { values?: Partial<T> };
    return parsed.values ?? null;
  } catch {
    return null;
  }
}
