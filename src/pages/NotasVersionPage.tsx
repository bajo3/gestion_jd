import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { releaseNotes } from "@/lib/releaseNotes";
import { formatDate } from "@/lib/utils";

export function NotasVersionPage() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Gestión JD" title="Notas de versión" description="Mejoras y cambios de cada actualización, de la más nueva a la más vieja." />
      <div className="space-y-4">
        {releaseNotes.map((note, index) => (
          <Card key={note.version}>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">v{note.version}</span>
                <h2 className="text-lg font-semibold text-slate-950">{note.title}</h2>
                <span className="text-sm text-slate-500">{formatDate(note.date)}</span>
                {index === 0 ? <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-700">Actual</span> : null}
              </div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
                {note.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
