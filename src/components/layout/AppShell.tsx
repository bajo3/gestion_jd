import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  CarFront,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileSpreadsheet,
  FileText,
  Home,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { logout } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const SIDEBAR_KEY = "jd-sidebar-collapsed";

const navigation = [
  { to: "/", label: "Inicio", icon: Home },
  { to: "/autos", label: "Historial de Autos", icon: CarFront },
  { to: "/ventas", label: "Ventas", icon: FileSpreadsheet },
  { to: "/ventas/seguimientos", label: "Seguimientos", icon: ClipboardList },
  { to: "/ventas/documentos", label: "Documentos", icon: FileText },
];

function isPathInSection(pathname: string, paths: string[]) {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

function isNavigationItemActive(pathname: string, to: string) {
  if (to === "/") return pathname === "/";

  if (to === "/ventas") {
    return isPathInSection(pathname, [
      "/ventas",
      "/ventas/seguimientos",
      "/ventas/documentos",
      "/calculadora-0km",
    ]);
  }

  return pathname === to || pathname.startsWith(`${to}/`);
}

export function AppShell() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_KEY) === "1");
  const location = useLocation();
  const navigate = useNavigate();

  const currentLabel = useMemo(
    () => {
      const currentItem = [...navigation]
        .sort((a, b) => b.to.length - a.to.length)
        .find((item) => isNavigationItemActive(location.pathname, item.to));

      return currentItem?.label ?? "Gestion JD";
    },
    [location.pathname],
  );

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const sidebarWidth = collapsed ? "lg:w-[96px]" : "lg:w-[292px]";

  const navContent = (
    <div
      className={cn(
        "flex h-full flex-col overflow-hidden bg-black text-white shadow-2xl shadow-black/20 transition-all duration-300",
        collapsed ? "w-[96px]" : "w-[292px]",
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-5">
        <Link
          to="/"
          className={cn("overflow-hidden transition-all", collapsed ? "w-0 opacity-0" : "w-full opacity-100")}
        >
          <img
            src="/logo-jd-negro.png"
            alt="Jesus Diaz Automotores"
            className="h-auto w-[190px] rounded-md bg-black"
          />
        </Link>

        <div className="flex items-center gap-2">
          <button
            className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <button
            className="hidden rounded-xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white lg:block"
            onClick={toggleCollapsed}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              title={collapsed ? item.label : undefined}
              className={() =>
                cn(
                  "group flex items-center rounded-2xl px-3 py-3 text-sm font-medium transition",
                  collapsed ? "justify-center" : "gap-3",
                  isNavigationItemActive(location.pathname, item.to)
                    ? "bg-[#ff0a8a] text-white"
                    : "text-white/72 hover:bg-white/10 hover:text-white",
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span
                className={cn(
                  "overflow-hidden whitespace-nowrap transition-all duration-300",
                  collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
                )}
              >
                {item.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <Button
          variant="secondary"
          className={cn(
            "w-full bg-white/8 text-white hover:bg-white/12",
            collapsed ? "justify-center px-0" : "justify-start",
          )}
          onClick={handleLogout}
          title={collapsed ? "Cerrar sesion" : undefined}
        >
          <LogOut className={cn("h-4 w-4 shrink-0", collapsed ? "" : "mr-2")} />
          <span className={cn("transition-all", collapsed ? "hidden" : "inline")}>Cerrar sesion</span>
        </Button>
        <p
          className={cn(
            "mt-3 text-xs text-white/45 transition-all",
            collapsed ? "hidden" : "block",
          )}
        >
          Desarrollado por felipe lentini
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <div
        className={cn(
          "hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:block",
          sidebarWidth,
        )}
      >
        {navContent}
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 bg-black/45 lg:hidden">
          <div className="h-full w-[292px]">{navContent}</div>
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-screen transition-all duration-300",
          collapsed ? "lg:ml-[128px]" : "lg:ml-[324px]",
        )}
      >
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                className="rounded-xl border border-slate-300 p-2 text-slate-700 lg:hidden"
                onClick={() => setOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{currentLabel}</h2>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
