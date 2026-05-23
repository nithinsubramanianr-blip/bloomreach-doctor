"use client";

import { useState } from "react";

import type { AgentResponse } from "@/lib/contracts";

const QUICK_ACTIONS = [
  "Why is my personalisation not working?",
  "What should I fix first?",
  "Show me what good personalisation looks like for my top 3 customer types",
];

const TOOL_LABEL: Record<string, string> = {
  fetchBRUIDMatchRate: "Session identity",
  fetchAutoSegmentCoverage: "Audience segments",
  fetchSignalFreshness: "Signal freshness",
  fetchRuleConflicts: "Merchandising rules",
  fetchABTestCoverage: "Experiment coverage",
};

const PRE_LOADED_EXCHANGE: AgentResponse = {
  query: "Why is my personalisation not working?",
  intent: "diagnosis",
  reasoning_trace: [
    {
      tool_name: "fetchBRUIDMatchRate",
      tool_input: {},
      tool_output_summary: "22% match rate — only 1 in 5 sessions identified",
    },
    {
      tool_name: "fetchAutoSegmentCoverage",
      tool_input: {},
      tool_output_summary: "14% coverage — most sessions have no audience segment",
    },
    {
      tool_name: "fetchSignalFreshness",
      tool_input: {},
      tool_output_summary: "58% freshness — signals are 3–7 days old",
    },
    {
      tool_name: "fetchRuleConflicts",
      tool_input: {},
      tool_output_summary: "95% conflict-free — rules are clean",
    },
    {
      tool_name: "fetchABTestCoverage",
      tool_input: {},
      tool_output_summary: "14% coverage — most queries have no A/B test",
    },
  ],
  llm_response: {
    summary_sentence:
      "Your personalisation is scoring 52/100 because most sessions can't be identified or assigned to a segment.",
    score_breakdown:
      "BRUID match is only 22% — guest sessions have no persistent identity. AutoSegment coverage is 14% — segments haven't been created yet. Signal freshness is acceptable at 58% but will degrade without BRUID improvement.",
    top_3_fixes: [
      "Create 3 manual audience segments in Bloomreach Engagement (12–18% RPV lift)",
      "Enable BRUID persistence for guest sessions (8–15% RPV lift)",
      "Configure A/B tests for personalised search queries (5–10% RPV lift)",
    ],
    suggested_next_action:
      "Start with audience segments — they unlock personalisation for 68% of your traffic with no code change required.",
  },
  timestamp: "2026-05-22T00:00:00Z",
};

export function NLChat() {
  const [exchanges, setExchanges] = useState<AgentResponse[]>([
    PRE_LOADED_EXCHANGE,
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(query: string) {
    const trimmed = query.trim();
    if (!trimmed || isLoading) return;
    setInput("");
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) throw new Error(`Agent error: ${res.status}`);
      const data = (await res.json()) as AgentResponse;
      setExchanges((prev) => [...prev, data]);
    } catch {
      setError("The Doctor couldn't be reached. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="animate-rise space-y-6">
      <section className="shadow-panel rounded-2xl border border-border bg-surface p-6">
        <h2 className="font-display text-2xl font-medium text-text">
          Ask the doctor
        </h2>
        <p className="mt-1 max-w-2xl text-[14px] text-muted">
          Plain-English guidance grounded in your Bloomreach signals. Every
          answer shows which data sources were consulted.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => ask(chip)}
              disabled={isLoading}
              className="rounded-full border border-border bg-surface-2 px-3.5 py-2 text-left text-[13px] text-text-body transition-colors hover:border-accent/40 hover:bg-accent-soft disabled:opacity-50"
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          className="mt-5 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about scores, fixes, or shopper segments…"
            className="flex-1 rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text-body placeholder:text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-accent-ink transition-all hover:brightness-105 disabled:opacity-50"
          >
            Ask
          </button>
        </form>

        {isLoading && (
          <p className="mt-4 text-[13px] text-muted">
            Consulting Bloomreach data…
          </p>
        )}
        {error && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="text-red">{error}</span>
            <button
              type="button"
              onClick={() => ask(exchanges[exchanges.length - 1]?.query ?? "")}
              className="rounded-lg border border-border px-3 py-1 text-xs text-muted hover:text-text"
            >
              Retry
            </button>
          </div>
        )}
      </section>

      <div className="space-y-5">
        {exchanges.map((exchange, i) => (
          <ExchangeView key={i} exchange={exchange} />
        ))}
      </div>
    </div>
  );
}

function ExchangeView({ exchange }: { exchange: AgentResponse }) {
  const { llm_response: answer } = exchange;

  function copyPlainText() {
    const text = [
      answer.summary_sentence,
      "",
      answer.score_breakdown,
      "",
      "Top fixes:",
      ...answer.top_3_fixes.map((f, i) => `${i + 1}. ${f}`),
      "",
      `Next: ${answer.suggested_next_action}`,
    ].join("\n");
    navigator.clipboard?.writeText(text);
  }

  return (
    <article className="shadow-panel overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="border-b border-border bg-surface-2/50 px-6 py-4">
        <p className="text-[13px] font-medium text-muted">Your question</p>
        <p className="mt-1 font-display text-lg text-text">{exchange.query}</p>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div className="rounded-xl border border-accent/20 bg-accent-soft/50 p-5">
          <p className="font-display text-[17px] font-medium leading-snug text-text">
            {answer.summary_sentence}
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            {answer.score_breakdown}
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-[14px] font-semibold text-text">
              Recommended fixes
            </h3>
            <span className="caption">intent · {exchange.intent}</span>
          </div>
          <ol className="space-y-2">
            {answer.top_3_fixes.map((fix, i) => (
              <li
                key={i}
                className="flex gap-3 rounded-lg border border-border bg-surface-2/40 px-4 py-3 text-[14px] text-text-body"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-[12px] font-semibold text-white">
                  {i + 1}
                </span>
                {fix}
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-border bg-surface-2/30 p-5">
          <h3 className="text-[14px] font-semibold text-text">
            Data sources consulted
          </h3>
          <p className="mt-1 text-[12px] text-faint">
            {exchange.reasoning_trace.length} signals checked across Discovery,
            Marketing, and Analytics
          </p>
          <ul className="mt-4 space-y-2">
            {exchange.reasoning_trace.map((step, i) => (
              <li
                key={i}
                className="grid gap-1 rounded-lg border border-border/70 bg-surface px-4 py-3 sm:grid-cols-[160px_1fr]"
              >
                <div>
                  <p className="text-[13px] font-medium text-text">
                    {TOOL_LABEL[step.tool_name] ?? step.tool_name}
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-faint">
                    {step.tool_name}
                  </p>
                </div>
                <p className="text-[13px] leading-snug text-muted">
                  {step.tool_output_summary}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-[14px] text-text-body">
            <span className="font-semibold text-accent">Next step: </span>
            {answer.suggested_next_action}
          </p>
          <button
            type="button"
            onClick={copyPlainText}
            className="text-[12px] text-faint transition-colors hover:text-text"
          >
            Copy answer
          </button>
        </div>
      </div>
    </article>
  );
}

export default NLChat;
