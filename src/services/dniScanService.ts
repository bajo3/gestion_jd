import { readDniFromImage, type DniData } from "@/lib/dniBarcode";
import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";

export type DniSide = "frente" | "dorso";

const SCAN_URL = "/api/dni-scan";
const BUCKET = "gestion-jd-documentos";
const MAX_SIDE = 1600;

/** Achica la foto del celular (varios MB) a un JPEG liviano que se sigue leyendo bien. */
export async function shrinkPhoto(file: Blob) {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo abrir la imagen. Probá con una foto JPG o PNG."));
      element.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("El navegador no permite procesar la imagen.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    return blob;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("No se pudo leer la foto."));
    reader.readAsDataURL(blob);
  });
}

/** Sube la foto ya achicada al archivo de documentos y devuelve su enlace. */
export async function uploadDniPhoto(photo: Blob, side: DniSide) {
  if (!isSupabaseConfigured || !supabase) throw new Error("No hay conexión con la base para guardar la foto.");
  const path = `dni/${generateId()}-${side}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, photo, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(`No se pudo guardar la foto: ${error.message}`);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export type DniPhoto = { side: DniSide; blob: Blob };

async function readWithAi(photos: DniPhoto[]): Promise<DniData> {
  const images = await Promise.all(
    photos.map(async (photo) => ({ side: photo.side, mediaType: "image/jpeg", data: await blobToBase64(await shrinkPhoto(photo.blob)) })),
  );
  const response = await fetch(SCAN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images }),
  });
  const body = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; dni?: DniData } | null;
  if (!response.ok || !body?.ok || !body.dni) throw new Error(body?.error || `No se pudo leer el DNI (codigo ${response.status}).`);
  return body.dni;
}

/**
 * Lee el DNI de las fotos. Primero prueba el codigo de barras (gratis y sin salir del equipo);
 * si no se lee, se las pasa a la IA, que ademas trae el domicilio del dorso.
 */
export async function readDniPhotos(photos: DniPhoto[]): Promise<{ data: DniData; via: "codigo" | "ia" }> {
  if (!photos.length) throw new Error("Falta la foto del DNI.");

  const hasBack = photos.some((photo) => photo.side === "dorso");
  for (const photo of photos) {
    const data = await readDniFromImage(photo.blob).catch(() => null);
    // Con el dorso cargado conviene la IA: el codigo no trae el domicilio.
    if (data && !hasBack) return { data, via: "codigo" };
    if (data && hasBack) {
      try {
        const ai = await readWithAi(photos);
        // Lo del codigo de barras es exacto: manda sobre lo que leyo la IA cuando trae dato.
        const merged = { ...ai };
        for (const [key, value] of Object.entries(data) as Array<[keyof DniData, string | undefined]>) {
          if (value) merged[key] = value;
        }
        return { data: merged, via: "ia" };
      } catch {
        return { data, via: "codigo" };
      }
    }
  }

  return { data: await readWithAi(photos), via: "ia" };
}
