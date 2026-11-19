import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Chrome/Edge avisan una sola vez, al cargar, que la app se puede instalar. Se guarda ese
 * aviso desde el arranque para poder mostrar el boton "Instalar app" cuando haga falta.
 */
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function captureInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone/iPad: Safari no tiene aviso de instalacion, se hace desde Compartir. */
function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function useInstallApp() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const listener = () => setTick((tick) => tick + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const installed = isInstalled();
  return {
    /** Hay que mostrar el boton: se puede instalar directo o, en iPhone, explicando los pasos. */
    available: !installed && (Boolean(deferred) || isIos()),
    needsInstructions: !deferred && isIos(),
    install: async () => {
      if (!deferred) return false;
      const prompt = deferred;
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      deferred = null;
      notify();
      return outcome === "accepted";
    },
  };
}
