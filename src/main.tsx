import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// App instalable (PWA): solo en produccion, para no interferir con la recarga en desarrollo.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const register = () => navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  if (document.readyState === "complete") register();
  else window.addEventListener("load", register, { once: true });
}
