import { Link } from "react-router-dom";
import { ClipboardList, FileText, Gauge, Receipt, ShieldCheck, Users, WalletCards } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";

const documents = [
  { to: "/compra-venta", title: "Compra y Venta", description: "Boleto y datos principales de la operacion.", icon: FileText },
  { to: "/autorizacion-conduccion", title: "Autorizacion", description: "Autorizacion de conduccion.", icon: ShieldCheck },
  { to: "/datero", title: "Datero", description: "Ficha de datos para la gestion.", icon: ClipboardList },
  { to: "/recibo", title: "Recibo", description: "Recibo de pago o sena.", icon: Receipt },
  { to: "/presupuesto", title: "Presupuesto", description: "Operacion con credito y entrega.", icon: WalletCards },
  { to: "/test-drive", title: "Test Drive", description: "Registro y autorizacion de prueba.", icon: Gauge },
  { to: "/formulario-cliente", title: "Formulario Cliente", description: "DNI, CUIL, situacion laboral e imagenes.", icon: Users },
];

export function VentasDocumentosPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Ventas"
        title="Documentos"
        description="Accesos rapidos a los documentos comerciales actuales."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {documents.map((document) => {
          const Icon = document.icon;
          return (
            <div key={document.to} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <Icon className="h-5 w-5 text-slate-700" />
              <h2 className="mt-4 text-lg font-semibold text-slate-950">{document.title}</h2>
              <p className="mt-2 min-h-10 text-sm text-slate-500">{document.description}</p>
              <Link to={document.to} className="mt-5 inline-flex">
                <Button>Crear</Button>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
