/**
 * Lee el DNI argentino desde una foto usando el codigo de barras del frente (PDF417).
 * Ese codigo trae nombre, apellido, numero y fecha de nacimiento tal cual figuran en el
 * documento, asi que no hace falta inteligencia artificial ni mandar la foto a ningun lado:
 * todo se resuelve en el telefono.
 */
export type DniData = {
  apellido: string;
  nombre: string;
  /** "Apellido Nombre", como lo piden los documentos. */
  nombreCompleto: string;
  dni: string;
  sexo: string;
  /** YYYY-MM-DD, listo para un campo de fecha. */
  fechaNacimiento: string;
  /** Solo si el DNI trae los digitos del CUIL. */
  cuil: string;
};

function titleCase(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])([a-záéíóúñü])/g, (_, separator: string, letter: string) => separator + letter.toUpperCase());
}

/** "15/03/1985" -> "1985-03-15" */
function toIsoDate(value: string) {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

/** "204" + DNI -> "20-30111222-4": los tres digitos son el prefijo y el verificador. */
function buildCuil(digits: string, dni: string) {
  const clean = digits.trim();
  if (!/^\d{3}$/.test(clean) || !dni) return "";
  return `${clean.slice(0, 2)}-${dni}-${clean.slice(2)}`;
}

/**
 * Interpreta el texto del codigo de barras. Hay dos formatos en circulacion:
 *
 * - DNI tarjeta actual: `tramite@APELLIDO@NOMBRE@SEXO@DNI@EJEMPLAR@NACIMIENTO@EMISION@CUIL`
 * - DNI tarjeta anterior: `@DNI@EJEMPLAR@1@APELLIDO@NOMBRE@NACIONALIDAD@NACIMIENTO@SEXO@...`
 */
export function parseDniBarcode(raw: string): DniData | null {
  const parts = raw.split("@").map((part) => part.trim());
  if (parts.length < 7) return null;

  const oldFormat = parts[0] === "";
  const apellido = oldFormat ? parts[4] : parts[1];
  const nombre = oldFormat ? parts[5] : parts[2];
  const dni = (oldFormat ? parts[1] : parts[4]).replace(/\D/g, "");
  const sexo = oldFormat ? parts[8] : parts[3];
  const nacimiento = oldFormat ? parts[7] : parts[6];
  const cuilDigits = oldFormat ? "" : (parts[8] ?? "");

  if (!/^\d{6,9}$/.test(dni) || !apellido || !nombre) return null;

  const cleanApellido = titleCase(apellido);
  const cleanNombre = titleCase(nombre);
  return {
    apellido: cleanApellido,
    nombre: cleanNombre,
    nombreCompleto: `${cleanApellido} ${cleanNombre}`.trim(),
    dni,
    sexo: (sexo ?? "").toUpperCase(),
    fechaNacimiento: toIsoDate(nacimiento ?? ""),
    cuil: buildCuil(cuilDigits, dni),
  };
}

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect(source: CanvasImageSource): Promise<DetectedBarcode[]> };
type BarcodeDetectorCtor = {
  new (options: { formats: string[] }): BarcodeDetectorLike;
  getSupportedFormats?: () => Promise<string[]>;
};

function loadImage(file: Blob) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("No se pudo abrir la imagen."));
    };
    image.src = url;
  });
}

/** Dibuja la foto en un canvas con el ancho y el giro pedidos. */
function drawToCanvas(image: HTMLImageElement, maxSide: number, quarterTurns: number) {
  const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const sideways = quarterTurns % 2 === 1;

  const canvas = document.createElement("canvas");
  canvas.width = sideways ? height : width;
  canvas.height = sideways ? width : height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("El navegador no permite procesar la imagen.");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((quarterTurns * Math.PI) / 2);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  return canvas;
}

/** El lector del propio navegador (Chrome en Android): rapido y muy tolerante con las fotos. */
async function readWithNativeDetector(image: HTMLImageElement) {
  const Detector = (globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  if (!Detector) return "";

  try {
    const formats = (await Detector.getSupportedFormats?.()) ?? [];
    if (formats.length && !formats.includes("pdf417")) return "";
    const detector = new Detector({ formats: ["pdf417"] });
    const found = await detector.detect(image);
    return found[0]?.rawValue ?? "";
  } catch {
    return "";
  }
}

/** Lector propio para los navegadores sin detector (iPhone, escritorio). Prueba tamaños y giros. */
async function readWithZxing(image: HTMLImageElement) {
  const zxing = await import("@zxing/library");
  const hints = new Map<unknown, unknown>([
    [zxing.DecodeHintType.POSSIBLE_FORMATS, [zxing.BarcodeFormat.PDF_417]],
    [zxing.DecodeHintType.TRY_HARDER, true],
  ]);

  for (const maxSide of [1600, 1100, 2400, 800]) {
    for (const quarterTurns of [0, 1, 2, 3]) {
      const canvas = drawToCanvas(image, maxSide, quarterTurns);
      const source = new zxing.HTMLCanvasElementLuminanceSource(canvas);
      for (const Binarizer of [zxing.HybridBinarizer, zxing.GlobalHistogramBinarizer]) {
        try {
          const reader = new zxing.PDF417Reader();
          const result = reader.decode(new zxing.BinaryBitmap(new Binarizer(source)), hints as never);
          const text = result.getText();
          if (text) return text;
        } catch {
          // Sin codigo en este intento: se prueba con otro tamaño, giro o contraste.
        }
      }
    }
  }
  return "";
}

/**
 * Devuelve los datos del DNI o null si en la foto no se pudo leer el codigo de barras.
 * La foto no sale del dispositivo.
 */
export async function readDniFromImage(file: Blob): Promise<DniData | null> {
  const image = await loadImage(file);
  const native = await readWithNativeDetector(image);
  const parsedNative = native ? parseDniBarcode(native) : null;
  if (parsedNative) return parsedNative;

  const decoded = await readWithZxing(image);
  return decoded ? parseDniBarcode(decoded) : null;
}
