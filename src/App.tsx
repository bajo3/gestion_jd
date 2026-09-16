import { useEffect, useState } from "react";
import { Router } from "@/app/router";
import { AppIntro } from "@/components/layout/AppIntro";

const INTRO_DURATION_MS = 2000;
const REDUCED_MOTION_DURATION_MS = 80;

/** El catalogo publico es para clientes: no muestra la intro del sistema interno. */
const PUBLIC_PATHS = ["/catalogo"];

function isPublicPath() {
  return PUBLIC_PATHS.some((path) => window.location.pathname.startsWith(path));
}

export default function App() {
  const [showIntro, setShowIntro] = useState(() => !isPublicPath());

  useEffect(() => {
    if (isPublicPath()) return;

    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeout = window.setTimeout(
      () => setShowIntro(false),
      prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS,
    );

    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <>
      <Router />
      {showIntro ? <AppIntro /> : null}
    </>
  );
}
