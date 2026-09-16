import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { parseAssistantWithGlm } from "./api/ai-assistant.js";
import { runWorkspaceAssistant } from "./api/workspace-assistant.js";
import { syncPriceListToSheet } from "./api/sheets-sync.js";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverEnvKeys = [
    "ZAI_API_KEY",
    "GLM_API_KEY",
    "ZAI_MODEL",
    "ZAI_BASE_URL",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_PRIVATE_KEY",
    "GOOGLE_SHEET_ID",
    "GOOGLE_SHEET_NAME",
  ];

  for (const key of serverEnvKeys) {
    if (!process.env[key] && env[key]) {
      process.env[key] = env[key];
    }
  }

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "gestion-jd-ai-assistant-api",
        configureServer(server) {
          async function readJsonBody(request: import("node:http").IncomingMessage) {
            const chunks: Buffer[] = [];
            for await (const chunk of request) {
              chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            }

            return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
          }

          function writeJson(response: import("node:http").ServerResponse, statusCode: number, body: unknown) {
            response.statusCode = statusCode;
            response.setHeader("Content-Type", "application/json");
            response.end(JSON.stringify(body));
          }

          function handlePost(
            request: import("node:http").IncomingMessage,
            response: import("node:http").ServerResponse,
            handler: (body: unknown) => Promise<{ ok: boolean } & Record<string, unknown>>,
          ) {
            if (request.method !== "POST") {
              writeJson(response, 405, { ok: false, error: "Metodo no permitido." });
              return;
            }

            readJsonBody(request)
              .then(handler)
              .then((result) => writeJson(response, result.ok ? 200 : 400, result))
              .catch((error) =>
                writeJson(response, 500, {
                  ok: false,
                  error: error instanceof Error ? error.message : "Error inesperado.",
                }),
              );
          }

          server.middlewares.use("/api/ai-assistant", async (request, response) => {
            handlePost(request, response, parseAssistantWithGlm);
          });

          server.middlewares.use("/api/workspace-assistant", async (request, response) => {
            handlePost(request, response, runWorkspaceAssistant);
          });

          server.middlewares.use("/api/sheets-sync", async (request, response) => {
            handlePost(request, response, syncPriceListToSheet);
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
