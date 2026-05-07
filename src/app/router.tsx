import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { isAuthenticated } from "@/lib/auth";
import { LoginPage } from "@/pages/LoginPage";
import { HomePage } from "@/pages/HomePage";
import { CompraVentaPage } from "@/pages/CompraVentaPage";
import { AutorizacionPage } from "@/pages/AutorizacionPage";
import { DateroPage } from "@/pages/DateroPage";
import { ReciboPage } from "@/pages/ReciboPage";
import { PresupuestoPage } from "@/pages/PresupuestoPage";
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

function ProtectedLayout() {
  const location = useLocation();
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <AppShell />;
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
        <Route path="/compra-venta" element={<CompraVentaPage />} />
        <Route path="/autorizacion-conduccion" element={<AutorizacionPage />} />
        <Route path="/datero" element={<DateroPage />} />
        <Route path="/recibo" element={<ReciboPage />} />
        <Route path="/presupuesto" element={<PresupuestoPage />} />
        <Route path="/test-drive" element={<TestDrivePage />} />
        <Route path="/calculadora-0km" element={<Calculadora0kmPage />} />
        <Route path="/formulario-cliente" element={<FormularioClientePage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
