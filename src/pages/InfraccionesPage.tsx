import { ExternalLink, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";

const infringementLinks = [
  {
    href: "https://monitoreovialentrerios.info/#/",
    title: "Monitoreo Vial Entre Rios",
    description: "Consulta de infracciones y control vial de Entre Rios.",
  },
  {
    href: "https://infraccionesba.gba.gob.ar/consulta-infraccion",
    title: "Infracciones BA",
    description: "Consulta de infracciones de la provincia de Buenos Aires.",
  },
];

export function InfraccionesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Infracciones"
        description="Accesos rapidos para consultar infracciones y monitoreo vial."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {infringementLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-[#ff0a8a]/30 hover:bg-[#fff7fb] hover:shadow-lg"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#fff0f8] text-[#ff0a8a]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-[#ff0a8a]" />
            </div>
            <h2 className="mt-4 text-lg font-semibold text-slate-950">{link.title}</h2>
            <p className="mt-2 text-sm text-slate-500">{link.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
