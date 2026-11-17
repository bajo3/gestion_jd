import { IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Botones para abrir las fotos del DNI guardadas con un documento (Datero, Formulario cliente). */
export function DniPhotoLinks({ data }: { data: Record<string, unknown> }) {
  const photos = [
    ["Foto DNI frente", data.dniFrenteUrl],
    ["Foto DNI dorso", data.dniDorsoUrl],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].startsWith("http"));

  if (!photos.length) return null;
  return (
    <>
      {photos.map(([label, url]) => (
        <a key={label} href={url} target="_blank" rel="noreferrer">
          <Button variant="outline">
            <IdCard className="mr-2 h-4 w-4" />
            {label}
          </Button>
        </a>
      ))}
    </>
  );
}
