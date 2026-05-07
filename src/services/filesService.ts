import { generateId } from "@/lib/utils";
import { isSupabaseConfigured, supabase } from "@/services/supabaseClient";
import type { VehicleFile, VehicleFileCategory } from "@/types/vehicles";

const BUCKET = "vehicle-files";

type UploadPayload = {
  vehicleId: string;
  file?: File | null;
  fileName: string;
  fileType: string;
  category: VehicleFileCategory;
  notes?: string;
};

async function readFileAsDataUrl(file: File) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadVehicleFile(payload: UploadPayload): Promise<VehicleFile> {
  const baseFile: VehicleFile = {
    id: generateId(),
    vehicleId: payload.vehicleId,
    fileName: payload.fileName,
    fileType: payload.fileType,
    category: payload.category,
    notes: payload.notes,
    size: payload.file?.size,
    createdAt: new Date().toISOString(),
  };

  if (!isSupabaseConfigured || !supabase || !payload.file) {
    if (!payload.file) {
      return baseFile;
    }

    try {
      const localUrl = await readFileAsDataUrl(payload.file);
      return {
        ...baseFile,
        fileUrl: localUrl,
      };
    } catch {
      return baseFile;
    }
  }

  try {
    const objectPath = `${payload.vehicleId}/${baseFile.id}-${payload.file.name}`;
    const { error } = await supabase.storage.from(BUCKET).upload(objectPath, payload.file, {
      upsert: true,
    });

    if (error) {
      try {
        const localUrl = await readFileAsDataUrl(payload.file);
        return {
          ...baseFile,
          fileUrl: localUrl,
        };
      } catch {
        return baseFile;
      }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

    return {
      ...baseFile,
      fileUrl: publicUrl,
    };
  } catch {
    try {
      const localUrl = await readFileAsDataUrl(payload.file);
      return {
        ...baseFile,
        fileUrl: localUrl,
      };
    } catch {
      return baseFile;
    }
  }
}
