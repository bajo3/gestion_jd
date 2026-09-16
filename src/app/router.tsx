import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated } from "@/lib/auth";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { CompraVentaPage } from "@/pages/CompraVentaPage";
import { AutorizacionPage } from "@/pages/AutorizacionPage";
import { DateroPage } from "@/pages/DateroPage";
import { ReciboPage } from "@/pages/ReciboPage";
import { PresupuestoPage } from "@/pages/PresupuestoPage";
import { OperacionFinalizadaPage } from "@/pages/OperacionFinalizadaPage";
import { ClientesPage } from "@/pages/ventas/ClientesPage";
import { ClienteDetallePage } from "@/pages/ventas/ClienteDetallePage";
import { TestDrivePage } from "@/pages/TestDrivePage";
import { Calculadora0kmPage } from "@/pages/Calculadora0kmPage";
import { FormularioClientePage } from "@/pages/FormularioClientePage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { AutosListPage } from "@/pages/autos/AutosListPage";
import { VehicleDetailPage } from "@/pages/autos/VehicleDetailPage";
import { VehicleEditPage } from "@/pages/autos/VehicleEditPage";
import { VehicleNewPage } from "@/pages/autos/VehicleNewPage";
import { VentasDashboardPage } from "@/pages/ventas/VentasDashboardPage";
import { VentasDocumentosPage } from "@/pages/ventas/VentasDocumentosPage";
import { VentasSeguimientosPage } from "@/pages/ventas/VentasSeguimientosPage";
import { InfraccionesPage } from "@/pages/InfraccionesPage";
import { ConsultasPage } from "@/pages/ConsultasPage";
import { LeadsPage } from "@/pages/LeadsPage";

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

export function Router() {
  return (
    <Routes>
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
        <Route path="/infracciones" element={<InfraccionesPage />} />
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
  );
}
