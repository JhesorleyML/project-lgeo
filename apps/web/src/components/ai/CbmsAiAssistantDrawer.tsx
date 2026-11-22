import React, { useEffect, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  Database,
  Globe2,
  Lock,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  CBMS_AI_STARTER_PROMPTS,
  type AiChatResponse,
  type AiMapAction,
  type AiToolCallTrace,
} from "@cbms/shared";
import { useMapFilterStore } from "../../store/useMapFilterStore";
import { useAuthStore } from "../../store/useAuthStore";

interface ChatTurn {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  privacyStatus?: "CLEARED_AGGREGATE_ONLY" | "BLOCKED_PII_REQUEST";
  providerUsed?: string;
  toolTraces?: AiToolCallTrace[];
  mapActions?: AiMapAction[];
  suggestedFollowUps?: string[];
}

/**
 * Lightweight, dependency-free Markdown renderer for CBMS statistical tables,
 * headings, bullet lists, blockquotes, and inline bold/code tokens.
 */
const MarkdownContent: React.FC<{ content: string }> = React.memo(({ content }) => {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let idx = 0;

  const formatInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={i}
            className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] text-sky-300 ring-1 ring-slate-700"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  while (idx < lines.length) {
    const line = lines[idx] ?? "";
    const trimmed = line.trim();

    if (!trimmed) {
      idx++;
      continue;
    }

    // Markdown Table Detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      const tableLines: string[] = [];
      while (idx < lines.length && (lines[idx] ?? "").trim().startsWith("|")) {
        tableLines.push((lines[idx] ?? "").trim());
        idx++;
      }

      if (tableLines.length >= 2) {
        const parseRow = (rowStr: string) =>
          rowStr
            .slice(1, -1)
            .split("|")
            .map((cell) => cell.trim());

        const headers = parseRow(tableLines[0]!);
        const dataRows = tableLines
          .slice(1)
          .filter((r) => !/^\|[\s:|-]+\|$/.test(r))
          .map(parseRow);

        elements.push(
          <div
            key={`tbl-${idx}`}
            className="my-2.5 overflow-x-auto rounded-lg border border-slate-700/80 bg-slate-950/80"
          >
            <table className="w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-300">
                  {headers.map((h, hIdx) => (
                    <th key={hIdx} className="px-2.5 py-1.5 font-semibold">
                      {formatInline(h)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {dataRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-slate-900/40">
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="px-2.5 py-1.5 text-slate-300">
                        {formatInline(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>,
        );
        continue;
      }
    }

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3
          key={idx}
          className="mt-2 mb-1 text-xs font-bold tracking-tight text-sky-300"
        >
          {formatInline(trimmed.slice(4))}
        </h3>,
      );
      idx++;
      continue;
    }

    if (trimmed.startsWith("#### ")) {
      elements.push(
        <h4
          key={idx}
          className="mt-2 mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-300"
        >
          {formatInline(trimmed.slice(5))}
        </h4>,
      );
      idx++;
      continue;
    }

    if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={idx}
          className="my-1.5 rounded-r-lg border-l-2 border-emerald-500 bg-emerald-950/30 px-3 py-1.5 text-[11px] text-emerald-200"
        >
          {formatInline(trimmed.slice(2))}
        </blockquote>,
      );
      idx++;
      continue;
    }

    if (trimmed.startsWith("- ")) {
      elements.push(
        <div key={idx} className="my-0.5 flex items-start gap-2 text-xs text-slate-300">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
          <span className="leading-relaxed">{formatInline(trimmed.slice(2))}</span>
        </div>,
      );
      idx++;
      continue;
    }

    elements.push(
      <p key={idx} className="my-1 text-xs leading-relaxed text-slate-300">
        {formatInline(trimmed)}
      </p>,
    );
    idx++;
  }

  return <div className="space-y-1">{elements}</div>;
});

MarkdownContent.displayName = "MarkdownContent";

export const CbmsAiAssistantDrawer: React.FC = () => {
  const {
    isAiDrawerOpen,
    surveyYear,
    activePage,
    setAiDrawerOpen,
    toggleAiDrawer,
    applyAiMapAction,
  } = useMapFilterStore();
  const { currentUser } = useAuthStore();

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [configuredProvider, setConfiguredProvider] = useState<{
    activeProvider: string;
    activeModel: string;
  }>({
    activeProvider: "builtin",
    activeModel: "cbms-deterministic-nl-engine",
  });
  const [turns, setTurns] = useState<ChatTurn[]>(() => [
    {
      id: "welcome-turn",
      role: "assistant",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      privacyStatus: "CLEARED_AGGREGATE_ONLY",
      providerUsed: "builtin",
      content: [
        "### CBMS AI Decision Support & Spatial Analyst",
        "I am connected to the **Municipality of San Jose, Dinagat Islands** CBMS database across all **12 Barangays**, **15 Survey Sections (`A–O + Poverty`, 312 columns)**, and **PostGIS 3.4** infrastructure layers.",
        "",
        "> **Zero-PII Protection (`RA 10173` & `RA 11315`)**: I operate on a **Hybrid Tool-Calling + Whitelisted Aggregation** architecture. Individual household member names (`a01_last_name`, `a01_first_name`), serial numbers (`HUSN`/`HSN`), and exact residential addresses are physically isolated and inaccessible to the AI model.",
        "",
        "Select a starter analysis below or ask any statistical, Year-over-Year (`2022 vs 2024`), or spatial catchment question:",
      ].join("\n"),
      suggestedFollowUps: CBMS_AI_STARTER_PROMPTS.slice(0, 3).map((p) => p.prompt),
    },
  ]);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // AGENTS.md §5: Always abort stale requests on unmount
  useEffect(() => {
    if (!isAiDrawerOpen) return;
    const metaCtrl = new AbortController();
    fetch("/api/v1/ai/metadata", { signal: metaCtrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { activeProvider?: string; activeModel?: string } | null) => {
        if (data?.activeProvider) {
          const activeProv = data.activeProvider;
          setConfiguredProvider({
            activeProvider: activeProv,
            activeModel: data.activeModel ?? activeProv,
          });
          setTurns((prev) =>
            prev.map((t) =>
              t.id === "welcome-turn" ? { ...t, providerUsed: activeProv } : t,
            ),
          );
        }
      })
      .catch(() => {
        // Ignore if server metadata not yet reachable
      });

    return () => {
      metaCtrl.abort();
    };
  }, [isAiDrawerOpen]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (isAiDrawerOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns, isAiDrawerOpen]);

  const submitPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isLoading) return;

    // Cancel any previous in-flight AI request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const userTurn: ChatTurn = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setTurns((prev) => [...prev, userTurn]);
    setInput("");
    setIsLoading(true);

    try {
      const historyPayload = turns.slice(-8).map((t) => ({
        role: t.role,
        content: t.content,
      }));

      const res = await fetch("/api/v1/ai/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(currentUser?.role ? { "x-cbms-role": currentUser.role } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          surveyYear,
          activeBarangayGeoCode: "ALL",
          activePage,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as AiChatResponse;
      const assistantTurn: ChatTurn = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        privacyStatus: data.privacyStatus,
        providerUsed: data.providerUsed,
        toolTraces: data.toolTraces,
        mapActions: data.mapActions,
        suggestedFollowUps: data.suggestedFollowUps,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return;
      }
      const fallbackTurn: ChatTurn = {
        id: `assistant-err-${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        privacyStatus: "CLEARED_AGGREGATE_ONLY",
        content:
          "Unable to reach `/api/v1/ai/chat`. Ensure `@cbms/server` is running on port 4000.",
      };
      setTurns((prev) => [...prev, fallbackTurn]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Pill when Drawer is Closed */}
      {!isAiDrawerOpen && (
        <button
          type="button"
          onClick={toggleAiDrawer}
          className="fixed right-5 bottom-5 z-50 flex items-center gap-2.5 rounded-2xl border border-sky-400/40 bg-gradient-to-r from-sky-600 to-indigo-600 px-4 py-3 text-xs font-bold text-white shadow-xl shadow-sky-950/60 transition hover:scale-[1.02] hover:from-sky-500 hover:to-indigo-500"
          title="Open CBMS AI Decision Support Analyst (Zero-PII RA 10173)"
        >
          <Bot className="h-4 w-4" />
          <span>CBMS AI Analyst</span>
          <span className="rounded-md bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200 ring-1 ring-emerald-400/40">
            Zero-PII
          </span>
        </button>
      )}

      {/* Slide-Over AI Decision Support Drawer */}
      {isAiDrawerOpen && (
        <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-slate-800 bg-slate-900/98 text-slate-100 shadow-2xl backdrop-blur-md">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold text-white">
                    CBMS AI Decision Support Analyst
                  </h2>
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                    <Lock className="h-2.5 w-2.5" />
                    RA 10173 Zero-PII
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Engine:{" "}
                  <span className="font-mono font-semibold text-sky-300">
                    {configuredProvider.activeProvider.toUpperCase()} (
                    {configuredProvider.activeModel})
                  </span>{" "}
                  • Year: {surveyYear}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTurns((prev) => prev.slice(0, 1))}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
                title="Clear conversation"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setAiDrawerOpen(false)}
                className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 transition hover:border-slate-700 hover:text-white"
                title="Close AI Assistant"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Curated Starter Prompt Strip */}
          <div className="border-b border-slate-800/80 bg-slate-950/40 px-4 py-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {CBMS_AI_STARTER_PROMPTS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void submitPrompt(item.prompt)}
                  className="shrink-0 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 py-1 text-left transition hover:border-sky-500/50 hover:bg-slate-800 disabled:opacity-50"
                >
                  <div className="text-[10px] font-semibold text-sky-400">{item.badge}</div>
                  <div className="text-[11px] font-medium text-slate-200">{item.title}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Message Stream */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex flex-col ${
                  turn.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[95%] rounded-2xl px-4 py-3 ${
                    turn.role === "user"
                      ? "bg-sky-600 text-xs font-medium text-white shadow-md"
                      : turn.privacyStatus === "BLOCKED_PII_REQUEST"
                        ? "border border-amber-500/40 bg-amber-950/25 text-slate-100"
                        : "border border-slate-800 bg-slate-950/90 text-slate-100"
                  }`}
                >
                  {/* Privacy & Provenance Header for Assistant turns */}
                  {turn.role === "assistant" && (
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-1.5 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-1 font-semibold text-slate-300">
                          <Sparkles className="h-3 w-3 text-sky-400" />
                          <span>CBMS Engine</span>
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                            turn.providerUsed === "gemini"
                              ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/40"
                              : turn.providerUsed === "ollama"
                                ? "bg-purple-500/20 text-purple-300 ring-1 ring-purple-500/40"
                                : turn.providerUsed === "openai"
                                  ? "bg-cyan-500/20 text-cyan-300 ring-1 ring-cyan-500/40"
                                  : "bg-slate-800 text-sky-300 ring-1 ring-slate-700"
                          }`}
                          title="The AI provider that synthesized this response"
                        >
                          {turn.providerUsed === "gemini"
                            ? "Gemini API"
                            : turn.providerUsed === "ollama"
                              ? "Local Ollama"
                              : turn.providerUsed === "openai"
                                ? "OpenAI API"
                                : "Built-in NL"}
                        </span>
                      </div>

                      {turn.privacyStatus === "BLOCKED_PII_REQUEST" ? (
                        <span className="flex items-center gap-1 rounded bg-amber-500/20 px-1.5 py-0.5 font-semibold text-amber-300">
                          <ShieldAlert className="h-3 w-3" />
                          PII Request Blocked (RA 10173)
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded bg-emerald-500/15 px-1.5 py-0.5 font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3" />
                          Zero-PII Aggregate Verified
                        </span>
                      )}
                    </div>
                  )}

                  {turn.role === "user" ? (
                    <p className="text-xs leading-relaxed">{turn.content}</p>
                  ) : (
                    <MarkdownContent content={turn.content} />
                  )}

                  {/* Kysely & PostGIS Tool Execution Traces */}
                  {turn.toolTraces && turn.toolTraces.length > 0 && (
                    <div className="mt-3 space-y-1.5 rounded-xl border border-slate-800/90 bg-slate-900/70 p-2.5 text-[10px]">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-400">
                        <Database className="h-3 w-3 text-sky-400" />
                        <span>Kysely / PostGIS Provenance & Index Trace:</span>
                      </div>
                      {turn.toolTraces.map((tr, tIdx) => (
                        <div key={tIdx} className="text-slate-400">
                          <span className="font-mono font-semibold text-sky-300">
                            {tr.toolName}
                          </span>{" "}
                          — {tr.summary}{" "}
                          <span className="text-slate-500">
                            ({tr.executionTimeMs}ms • Indexes:{" "}
                            {tr.spatialOrDbIndexesUsed.join(", ")})
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Interactive Web-GIS Map Action Buttons */}
                  {turn.mapActions && turn.mapActions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {turn.mapActions.map((act, aIdx) => (
                        <button
                          key={aIdx}
                          type="button"
                          onClick={() => applyAiMapAction(act)}
                          className="flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-2.5 py-1.5 text-[11px] font-semibold text-sky-300 ring-1 ring-sky-500/40 transition hover:bg-sky-500/30 hover:text-white"
                        >
                          <Globe2 className="h-3.5 w-3.5" />
                          <span>{act.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Suggested Follow-Up Prompts */}
                  {turn.suggestedFollowUps && turn.suggestedFollowUps.length > 0 && (
                    <div className="mt-3 border-t border-slate-800/80 pt-2">
                      <p className="mb-1.5 text-[10px] font-semibold text-slate-400">
                        Suggested Follow-Up Questions:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {turn.suggestedFollowUps.map((q, qIdx) => (
                          <button
                            key={qIdx}
                            type="button"
                            disabled={isLoading}
                            onClick={() => void submitPrompt(q)}
                            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-left text-[10px] text-slate-300 transition hover:border-sky-500/40 hover:text-sky-300"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <span className="mt-1 px-1 text-[10px] text-slate-500">
                  {turn.timestamp}
                </span>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-400">
                <div className="h-2 w-2 animate-ping rounded-full bg-sky-400" />
                <span>
                  Executing zero-PII Kysely / PostGIS aggregation across 312 CBMS columns...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitPrompt(input);
            }}
            className="border-t border-slate-800 bg-slate-950/90 p-3"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about barangay poverty, 4Ps gap, WASH, YoY trends, or 500m catchments..."
                className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-500 disabled:opacity-40"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Ask</span>
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-slate-500">
              Protected by RA 10173 & RA 11315: Individual member names, serials, and exact addresses are blocked by design.
            </p>
          </form>
        </aside>
      )}
    </>
  );
};
