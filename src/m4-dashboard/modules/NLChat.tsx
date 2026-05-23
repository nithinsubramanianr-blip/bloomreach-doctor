"use client";

import { useState } from "react";

import type { AgentResponse } from "@/lib/contracts";

/**
 * Module C — Ask the Doctor. Renders a pre-loaded exchange on mount (no API
 * call), three quick-action chips, and a free-text box. Submitting calls the
 * M3 agent route (/api/agent), which returns the reasoning trace + answer.
 */

const QUICK_ACTIONS = [
  "Why is my personalisation not working?",
  "What should I fix first?",
  "Show me what good personalisation looks like for my top 3 customer types",
];

// Static pre-loaded exchange (design-spec 004) — rendered immediately on load.
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
    <div className="rounded-xl border border-black/10 bg-white p-6">
      {/* Quick-action chips */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => ask(chip)}
            disabled={isLoading}
            className="rounded-full border border-teal/40 bg-teal/5 px-3 py-1.5 text-xs font-medium text-teal hover:bg-teal/10 disabled:opacity-50"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input */}
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the Doctor about your personalisation…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="rounded-lg bg-teal px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          Ask
        </button>
      </form>

      {isLoading && (
        <p className="mt-3 animate-pulse text-sm text-gray-500">
          Consulting Bloomreach data…
        </p>
      )}
      {error && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-red">{error}</span>
          <button
            type="button"
            onClick={() => ask(exchanges[exchanges.length - 1]?.query ?? "")}
            className="rounded border border-gray-300 px-2 py-1 text-xs hover:bg-gray-50"
          >
            Retry
          </button>
        </div>
      )}

      {/* Exchanges (newest last) */}
      <div className="mt-6 space-y-6">
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
    <div className="border-t border-black/5 pt-4 first:border-t-0 first:pt-0">
      <p className="text-sm font-semibold text-navy">Q: {exchange.query}</p>

      {/* Reasoning trace — collapsed by default */}
      <details className="mt-2 rounded-lg bg-gray-50 p-3">
        <summary className="cursor-pointer text-xs font-medium text-gray-500">
          Reasoning trace ({exchange.reasoning_trace.length} tool calls)
        </summary>
        <ul className="mt-2 space-y-1">
          {exchange.reasoning_trace.map((step, i) => (
            <li key={i} className="text-xs text-gray-600">
              <span className="font-mono text-teal">{step.tool_name}</span>
              {" → "}
              {step.tool_output_summary}
            </li>
          ))}
        </ul>
      </details>

      {/* Plain-English answer — expanded */}
      <div className="mt-3 space-y-2 text-sm text-gray-700">
        <p className="font-medium text-navy">{answer.summary_sentence}</p>
        <p>{answer.score_breakdown}</p>
        <ol className="list-decimal space-y-1 pl-5">
          {answer.top_3_fixes.map((fix, i) => (
            <li key={i}>{fix}</li>
          ))}
        </ol>
        <p className="rounded-lg bg-teal/5 px-3 py-2 text-teal">
          <span className="font-semibold">Next: </span>
          {answer.suggested_next_action}
        </p>
        <button
          type="button"
          onClick={copyPlainText}
          className="text-xs text-gray-400 hover:text-navy"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

export default NLChat;
