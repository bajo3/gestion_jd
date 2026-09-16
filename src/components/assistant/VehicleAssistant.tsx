import { useMemo, useState } from "react";
import { Bot, Check, Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  documentLabels,
  documentRoutes,
  saveDocumentDraft,
} from "@/services/documentDraftService";
import {
  applyAssistantDraft,
  buildAssistantDraft,
  buildAssistantSummary,
  getMissingAssistantFields,
  type AssistantDraft,
} from "@/services/vehicleAssistantService";
import {
  askWorkspaceAssistant,
  isWorkspaceQuestion,
  type WorkspaceAssistantAction,
} from "@/services/workspaceAssistantService";
import type { Vehicle } from "@/types/vehicles";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
};

function messageId() {
  return `assistant-message-${Date.now()}-${Math.round(Math.random() * 100000)}`;
}

function assistantMessage(content: string): ChatMessage {
  return { id: messageId(), role: "assistant", content };
}

function userMessage(content: string): ChatMessage {
  return { id: messageId(), role: "user", content };
}

function vehicleLabel(vehicle: Vehicle) {
  return `${vehicle.brand} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}${vehicle.licensePlate ? ` (${vehicle.licensePlate})` : ""}`;
}

function buildDraftMessage(draft: AssistantDraft) {
  const summary = buildAssistantSummary(draft);
  const missing = getMissingAssistantFields(draft);

  if (!summary.length) {
    return "No encontre datos suficientes todavia. Proba con algo como: vendido Ford Ecosport 2017 39.000km $17.800.000 comprador Juan Perez tel 1122334455.";
  }

  const target = draft.targetLabel
    ? `Voy a actualizar ${draft.targetLabel}.`
    : draft.candidates.length > 1
      ? "Encontre mas de un auto parecido. Necesito la patente o que elijas uno."
      : "Voy a crear un auto nuevo si no existe en el historial.";

  const missingLine = missing.length
    ? `Falta: ${missing.join(", ")}.`
    : "No veo faltantes importantes para este movimiento.";

  return `${target}\n${summary.join("\n")}\n${missingLine}`;
}

export function VehicleAssistant() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<AssistantDraft | null>(null);
  const [workspaceAction, setWorkspaceAction] = useState<WorkspaceAssistantAction | null>(null);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    assistantMessage(
      "Decime una operacion o pregunta de gestion. Ejemplos: vendido Ford Ecosport 2017..., que lead falta contestar, resumen del mes, o haceme un boleto compra venta.",
    ),
  ]);

  const missing = useMemo(() => (draft ? getMissingAssistantFields(draft) : []), [draft]);
  const summary = useMemo(() => (draft ? buildAssistantSummary(draft) : []), [draft]);
  const canApply = Boolean(
    (draft?.targetVehicleId || (draft?.values.brand && draft.values.model)) &&
      !(draft.candidates.length > 1 && !draft.targetVehicleId),
  );

  const addAssistantReply = (content: string) => {
    setMessages((current) => [...current, assistantMessage(content)]);
  };

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || loading || applying) return;

    setInput("");
    setLoading(true);
    setMessages((current) => [...current, userMessage(text)]);

    try {
      if (isWorkspaceQuestion(text) && !draft) {
        const action = await askWorkspaceAssistant(text);
        if (action.actionType === "vehicleDraft") {
          const nextDraft = await buildAssistantDraft(text, undefined);
          setDraft(nextDraft);
          setWorkspaceAction(null);
          addAssistantReply(buildDraftMessage(nextDraft));
          return;
        }

        setWorkspaceAction(action.actionType === "answer" ? null : action);
        addAssistantReply(action.reply);
        return;
      }

      const nextDraft = await buildAssistantDraft(text, draft ?? undefined);
      setDraft(nextDraft);
      setWorkspaceAction(null);
      addAssistantReply(buildDraftMessage(nextDraft));
    } catch {
      addAssistantReply("No pude interpretar eso. Probemos con marca, modelo, anio, kilometros, precio y comprador.");
    } finally {
      setLoading(false);
    }
  };

  const selectCandidate = (vehicle: Vehicle) => {
    if (!draft) return;
    const nextDraft = {
      ...draft,
      targetVehicleId: vehicle.id,
      targetLabel: vehicleLabel(vehicle),
      mode: "update" as const,
      candidates: [vehicle],
    };
    setDraft(nextDraft);
    addAssistantReply(`Listo, voy a actualizar ${vehicleLabel(vehicle)}.`);
  };

  const applyDraft = async () => {
    if (!draft || !canApply || applying) return;

    setApplying(true);
    try {
      const result = await applyAssistantDraft(draft);
      const action = result.mode === "update" ? "actualizado" : "creado";
      setDraft(null);
      addAssistantReply(`Listo, deje ${action} el registro de ${vehicleLabel(result.vehicle)}.`);
      navigate(`/autos/${result.vehicle.id}`);
    } catch {
      addAssistantReply("No pude guardar el movimiento. Revisa la conexion o intenta otra vez.");
    } finally {
      setApplying(false);
    }
  };

  const resetDraft = () => {
    setDraft(null);
    setWorkspaceAction(null);
    addAssistantReply("Borrador limpio. Mandame la proxima operacion.");
  };

  const runWorkspaceAction = () => {
    if (!workspaceAction) return;

    if (workspaceAction.actionType === "documentDraft" && workspaceAction.documentType) {
      saveDocumentDraft(workspaceAction.documentType, workspaceAction.values ?? {});
      navigate(documentRoutes[workspaceAction.documentType]);
      addAssistantReply(`Abrí ${documentLabels[workspaceAction.documentType]} con el borrador cargado.`);
      setOpen(false);
      return;
    }

    if (workspaceAction.path) {
      navigate(workspaceAction.path);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-white shadow-xl shadow-slate-900/25 transition hover:-translate-y-0.5 hover:bg-slate-800"
        onClick={() => setOpen((current) => !current)}
        title="Asistente"
      >
        {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {open ? (
        <section className="fixed bottom-24 right-4 z-50 flex h-[min(680px,calc(100vh-120px))] w-[calc(100vw-32px)] max-w-[440px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/20">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-slate-950">Asistente JD</h2>
                <p className="text-xs text-slate-500">Gestion, ventas, leads y documentos</p>
              </div>
            </div>
            <button
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              onClick={() => setOpen(false)}
              title="Cerrar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "max-w-[88%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-6",
                  message.role === "user"
                    ? "ml-auto bg-slate-950 text-white"
                    : "bg-white text-slate-700 shadow-sm ring-1 ring-slate-200",
                )}
              >
                {message.content}
              </div>
            ))}
            {loading ? (
              <div className="flex max-w-[88%] items-center gap-2 rounded-2xl bg-white px-3 py-2 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
                <Loader2 className="h-4 w-4 animate-spin" />
                Leyendo datos...
              </div>
            ) : null}
          </div>

          {draft ? (
            <div className="border-t border-slate-200 bg-white px-4 py-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Borrador</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {draft.mode === "update" ? "Actualizar" : "Crear"} - {draft.source === "glm-5.2" ? "GLM 5.2" : "Local"}
                  </span>
                </div>
                {summary.length ? (
                  <div className="mt-2 space-y-1 text-xs text-slate-700">
                    {summary.slice(0, 5).map((item) => (
                      <p key={item}>{item}</p>
                    ))}
                  </div>
                ) : null}
                {missing.length ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">Falta: {missing.join(", ")}.</p>
                ) : null}
                {draft.candidates.length > 1 && !draft.targetVehicleId ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {draft.candidates.slice(0, 4).map((candidate) => (
                      <Button
                        key={candidate.id}
                        variant="outline"
                        className="h-auto px-3 py-2 text-xs"
                        onClick={() => selectCandidate(candidate)}
                      >
                        {vehicleLabel(candidate)}
                      </Button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" disabled={!canApply || applying} onClick={applyDraft}>
                    {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                    Aplicar
                  </Button>
                  <Button variant="ghost" onClick={resetDraft}>
                    Limpiar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          {workspaceAction ? (
            <div className="border-t border-slate-200 bg-white px-4 py-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase text-slate-500">Accion</p>
                  <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                    {workspaceAction.model === "glm-5.2" ? "GLM 5.2" : "Asistente"}
                  </span>
                </div>
                {workspaceAction.missing?.length ? (
                  <p className="mt-2 text-xs font-medium text-amber-700">Falta: {workspaceAction.missing.join(", ")}.</p>
                ) : null}
                <div className="mt-3 flex gap-2">
                  <Button className="flex-1" onClick={runWorkspaceAction}>
                    {workspaceAction.actionType === "documentDraft"
                      ? `Abrir ${workspaceAction.documentType ? documentLabels[workspaceAction.documentType] : "documento"}`
                      : workspaceAction.title || "Abrir"}
                  </Button>
                  <Button variant="ghost" onClick={() => setWorkspaceAction(null)}>
                    Ocultar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSubmit();
                  }
                }}
                placeholder="Escribi una venta, consulta o documento..."
                className="min-h-12 resize-none rounded-xl"
              />
              <Button className="h-12 w-12 shrink-0 px-0" onClick={handleSubmit} disabled={loading || applying || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>Puede responder, abrir secciones y preparar documentos.</span>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
