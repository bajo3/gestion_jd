import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { login } from "@/lib/auth";

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname || "/";

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (login(username, password)) {
      navigate(from, { replace: true });
      return;
    }
    setError("Usuario o contraseña incorrectos.");
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,10,138,0.14),_transparent_28%),linear-gradient(180deg,_#fcfcfd,_#eef1f4)] px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <img src="/logo-jd-negro.png" alt="Jesus Diaz Automotores" className="h-auto w-full max-w-[360px]" />
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500">
              Jesus Diaz Automotores
            </p>
            <h1 className="max-w-3xl text-5xl font-black tracking-tight text-slate-950">
              Gestion interna modernizada para documentos, operaciones y stock.
            </h1>
            <p className="max-w-2xl text-lg text-slate-600">
              Acceso centralizado a formularios, historial de autos, recibos correlativos y herramientas operativas.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {["Panel responsive", "PDFs migrados", "Historial de autos"].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm">
                <p className="font-semibold text-slate-900">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-white/60 bg-white/90 shadow-2xl shadow-slate-300/30">
          <CardContent className="space-y-6 p-8">
            <div className="space-y-2">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
                Acceso
              </p>
              <h2 className="text-3xl font-bold text-slate-950">Iniciar sesion</h2>
              <p className="text-sm text-slate-500">
                Credenciales actuales: usuario <strong>admin</strong>, clave <strong>2025</strong>.
              </p>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Usuario
                <Input value={username} onChange={(event) => setUsername(event.target.value)} />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                Contraseña
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>

              {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}

              <Button type="submit" className="w-full bg-black text-white hover:bg-black/90">
                <LockKeyhole className="mr-2 h-4 w-4" />
                Entrar
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
