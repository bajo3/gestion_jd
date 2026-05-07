import { CarFront, ExternalLink, FileStack, ShieldCheck, WalletCards } from "lucide-react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent } from "@/components/ui/card";

const documents = [
  { to: "/compra-venta", title: "Compra y Venta", description: "Boleto de compra venta.", icon: FileStack },
  { to: "/autorizacion-conduccion", title: "Autorizacion", description: "Permiso para circular.", icon: ShieldCheck },
  { to: "/datero", title: "Datero", description: "Formulario de transferencia.", icon: CarFront },
  { to: "/recibo", title: "Recibo", description: "Recibo con original y duplicado.", icon: WalletCards },
  { to: "/presupuesto", title: "Presupuesto", description: "Operacion con credito y entrega.", icon: FileStack },
  { to: "/test-drive", title: "Test Drive", description: "Formulario y acuerdo de responsabilidad.", icon: CarFront },
  { to: "/calculadora-0km", title: "Calculadora 0 km", description: "Quebranto, cuota y resumen operativo.", icon: WalletCards },
  { to: "/formulario-cliente", title: "Formulario Cliente", description: "DNI, CUIL, situacion laboral e imagenes.", icon: FileStack },
];

const externalLinks = [
  { href: "https://www.dnrpa.gov.ar/portal_dnrpa/", label: "DNRPA" },
  { href: "https://app.arba.gov.ar/AvisoDeudas/?imp=1", label: "Deudas ARBA" },
  { href: "https://infraccionesba.gba.gob.ar/consulta-infraccion", label: "Infracciones BA" },
  { href: "https://docs.google.com/spreadsheets/d/1_EL8FCS9UuqxeXuB6dXFxK7EQN7SJla6dHG3SeL7_ps/edit?usp=sharing", label: "Lista de precios" },
  { href: "https://docs.google.com/spreadsheets/d/1tpn1gbeubEnARkF2iwJIiWsK8AA3kV9QNWeEzEpzthM/edit?gid=1895596246#gid=1895596246", label: "Lista de transferencias" },
];

export function HomePage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Jesus Diaz Automotores"
        description="Acceso rapido a documentos, historial de autos y herramientas internas."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {documents.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.to} to={item.to}>
              <Card className="h-full transition hover:-translate-y-1 hover:shadow-lg">
                <CardContent className="space-y-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff0f8] text-[#ff0a8a]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-500">{item.description}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {externalLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-800 transition hover:border-[#ff0a8a]/30 hover:bg-[#fff7fb]"
            >
              <span>{link.label}</span>
              <ExternalLink className="h-4 w-4 text-slate-400" />
            </a>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
