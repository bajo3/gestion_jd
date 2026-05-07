import { useEffect, useState } from "react";
import { Router } from "@/app/router";
import { AppIntro } from "@/components/layout/AppIntro";

const INTRO_DURATION_MS = 2000;
const REDUCED_MOTION_DURATION_MS = 80;

export default function App() {
  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
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
