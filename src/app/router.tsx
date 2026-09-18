import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazy, Suspense, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated } from "@/lib/auth";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Cada pantalla se descarga solo cuando se visita, asi la carga inicial
// (login + menu) no trae todas las paginas de una vez.
const HomePage = lazy(() => import("@/pages/HomePage").then((m) => ({ default: m.HomePage })));
const CompraVentaPage = lazy(() => import("@/pages/CompraVentaPage").then((m) => ({ default: m.CompraVentaPage })));
const AutorizacionPage = lazy(() => import("@/pages/AutorizacionPage").then((m) => ({ default: m.AutorizacionPage })));
const DateroPage = lazy(() => import("@/pages/DateroPage").then((m) => ({ default: m.DateroPage })));
const ReciboPage = lazy(() => import("@/pages/ReciboPage").then((m) => ({ default: m.ReciboPage })));
const PresupuestoPage = lazy(() => import("@/pages/PresupuestoPage").then((m) => ({ default: m.PresupuestoPage })));
const OperacionFinalizadaPage = lazy(() =>
  import("@/pages/OperacionFinalizadaPage").then((m) => ({ default: m.OperacionFinalizadaPage })),
);
const ClientesPage = lazy(() => import("@/pages/ventas/ClientesPage").then((m) => ({ default: m.ClientesPage })));
const ClienteDetallePage = lazy(() =>
  import("@/pages/ventas/ClienteDetallePage").then((m) => ({ default: m.ClienteDetallePage })),
);
const TestDrivePage = lazy(() => import("@/pages/TestDrivePage").then((m) => ({ default: m.TestDrivePage })));
const Calculadora0kmPage = lazy(() =>
  import("@/pages/Calculadora0kmPage").then((m) => ({ default: m.Calculadora0kmPage })),
);
const FormularioClientePage = lazy(() =>
  import("@/pages/FormularioClientePage").then((m) => ({ default: m.FormularioClientePage })),
);
const AutosListPage = lazy(() => import("@/pages/autos/AutosListPage").then((m) => ({ default: m.AutosListPage })));
const VehicleDetailPage = lazy(() =>
  import("@/pages/autos/VehicleDetailPage").then((m) => ({ default: m.VehicleDetailPage })),
);
const VehicleEditPage = lazy(() =>
  import("@/pages/autos/VehicleEditPage").then((m) => ({ default: m.VehicleEditPage })),
);
const VehicleNewPage = lazy(() => import("@/pages/autos/VehicleNewPage").then((m) => ({ default: m.VehicleNewPage })));
const VentasDashboardPage = lazy(() =>
  import("@/pages/ventas/VentasDashboardPage").then((m) => ({ default: m.VentasDashboardPage })),
);
const VentasDocumentosPage = lazy(() =>
  import("@/pages/ventas/VentasDocumentosPage").then((m) => ({ default: m.VentasDocumentosPage })),
);
const VentasSeguimientosPage = lazy(() =>
  import("@/pages/ventas/VentasSeguimientosPage").then((m) => ({ default: m.VentasSeguimientosPage })),
);
const InfraccionesPage = lazy(() => import("@/pages/InfraccionesPage").then((m) => ({ default: m.InfraccionesPage })));
const PendientesPage = lazy(() => import("@/pages/PendientesPage").then((m) => ({ default: m.PendientesPage })));
const LeadsPage = lazy(() => import("@/pages/LeadsPage").then((m) => ({ default: m.LeadsPage })));
const ConsultasPage = lazy(() => import("@/pages/ConsultasPage").then((m) => ({ default: m.ConsultasPage })));
const ListaPreciosPage = lazy(() =>
  import("@/pages/precios/ListaPreciosPage").then((m) => ({ default: m.ListaPreciosPage })),
);
const CatalogoPage = lazy(() => import("@/pages/catalogo/CatalogoPage").then((m) => ({ default: m.CatalogoPage })));

function ProtectedLayout() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <AppShell />;
}

function ContextualDocument({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <div key={`${location.pathname}${location.search}`}>{children}</div>;
}

function RouteLoading() {
  return (
    <div className="flex items-center gap-2 p-8 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      Cargando...
    </div>
  );
}

export function Router() {
  return (
    <Suspense fallback={<RouteLoading />}>
      <Routes>
        <Route path="/catalogo" element={<CatalogoPage />} />
        <Route
          path="/login"
          element={isAuthenticated() ? <Navigate to="/" replace /> : <LoginPage />}
        />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/autos" element={<AutosListPage />} />
          <Route path="/autos/nuevo" element={<VehicleNewPage />} />
          <Route path="/autos/:id" element={<VehicleDetailPage />} />
          <Route path="/autos/:id/editar" element={<VehicleEditPage />} />
          <Route path="/ventas" element={<VentasDashboardPage />} />
          <Route path="/ventas/seguimientos" element={<VentasSeguimientosPage />} />
          <Route path="/ventas/documentos" element={<VentasDocumentosPage />} />
          <Route path="/ventas/clientes" element={<ClientesPage />} />
          <Route path="/ventas/clientes/:id" element={<ClienteDetallePage />} />
          <Route path="/leads" element={<LeadsPage />} />
          <Route path="/consultas" element={<ConsultasPage />} />
          <Route path="/lista-precios" element={<ListaPreciosPage />} />
          <Route path="/infracciones" element={<InfraccionesPage />} />
          <Route path="/pendientes" element={<PendientesPage />} />
          <Route path="/compra-venta" element={<ContextualDocument><CompraVentaPage /></ContextualDocument>} />
          <Route path="/autorizacion-conduccion" element={<ContextualDocument><AutorizacionPage /></ContextualDocument>} />
          <Route path="/datero" element={<ContextualDocument><DateroPage /></ContextualDocument>} />
          <Route path="/recibo" element={<ContextualDocument><ReciboPage /></ContextualDocument>} />
          <Route path="/presupuesto" element={<OperacionFinalizadaPage />} />
          <Route path="/operacion-finalizada" element={<OperacionFinalizadaPage />} />
          <Route path="/presupuesto-cliente" element={<PresupuestoPage />} />
          <Route path="/test-drive" element={<TestDrivePage />} />
          <Route path="/calculadora-0km" element={<Calculadora0kmPage />} />
          <Route path="/formulario-cliente" element={<ContextualDocument><FormularioClientePage /></ContextualDocument>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
