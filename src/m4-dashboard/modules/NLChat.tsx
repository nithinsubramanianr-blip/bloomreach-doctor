/**
 * NLChat.tsx — Module C (Ask the Doctor)
 *
 * On mount: renders PRE_LOADED_EXCHANGE with NO API call.
 * Quick-action chips trigger handleQuery from M3.
 * Submit triggers handleQuery from M3.
 * Shows reasoning trace (collapsed by default) and plain-English answer.
 * Loading: "Consulting Bloomreach data..."
 * Error: message + Retry button.
 * Copy button on plain-English answer.
 *
 * CRITICAL: Do NOT import @anthropic-ai/sdk here (Invariant #5).
 * Do NOT useEffect to fetch on mount.
 */

import React, { useState, useRef } from 'react';
// CJS modules imported as ESM default — Vite/esbuild synthesises named exports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import constantsModule from '../../m3-nl/constants.js';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import queryHandlerModule from '../../m3-nl/query-handler.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
const { PRE_LOADED_EXCHANGE } = constantsModule as any;
const { handleQuery }         = queryHandlerModule as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

import type { PRSState } from './PRSScorecard';

// --------------------------------------------------------------------------
// Quick-action chip text (exact — from spec)
// --------------------------------------------------------------------------

const QUICK_ACTION_CHIPS: readonly string[] = [
  'Why is my personalisation not working?',
  'What should I fix first?',
  'Show me what good personalisation looks like for my top 3 customer types',
];

// --------------------------------------------------------------------------
// Types mirroring M3→M4 Agent Response Object contract (CLAUDE.md)
// --------------------------------------------------------------------------

interface ReasoningStep {
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output_summary: string;
}

interface LLMResponse {
  summary_sentence: string;
  score_breakdown: string;
  top_3_fixes: string[];
  suggested_next_action: string;
}

interface AgentResponse {
  query: string;
  intent: string;
  reasoning_trace: ReasoningStep[];
  llm_response: LLMResponse;
  timestamp: string;
  error?: boolean;
  error_message?: string;
}

export interface NLChatProps {
  prsState: PRSState | null;
}

// --------------------------------------------------------------------------
// ReasoningTrace panel (collapsed by default)
// --------------------------------------------------------------------------

function ReasoningTracePanel({ trace }: { trace: ReasoningStep[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!trace || trace.length === 0) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50" data-testid="reasoning-trace-panel">
      <button
        onClick={() => setExpanded(e => !e)}
        data-testid="reasoning-trace-toggle"
        className="flex w-full items-center justify-between px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700"
        aria-expanded={expanded}
      >
        <span>Reasoning Trace ({trace.length} tool calls)</span>
        <span className="ml-2 text-slate-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y divide-slate-100 border-t border-slate-200">
          {trace.map((step, idx) => (
            <div key={idx} className="px-4 py-3 text-xs" data-testid={`trace-step-${idx}`}>
              <p className="font-mono font-semibold" style={{ color: '#7C3AED' }}>
                {step.tool_name}
              </p>
              <p className="mt-0.5 text-slate-600">{step.tool_output_summary}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------------------------------
// Plain-English Answer (expanded by default)
// --------------------------------------------------------------------------

function PlainEnglishAnswer({ response, onCopy }: { response: LLMResponse; onCopy: () => void }) {
  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-white p-4" data-testid="plain-english-answer">
      {/* Summary */}
      <p className="text-sm font-semibold" style={{ color: '#2D1BB5' }}>
        {response.summary_sentence}
      </p>

      {/* Score breakdown */}
      {response.score_breakdown && (
        <p className="mt-2 text-sm text-slate-600">{response.score_breakdown}</p>
      )}

      {/* Top 3 fixes */}
      {response.top_3_fixes && response.top_3_fixes.length > 0 && (
        <ul className="mt-3 space-y-1 pl-4">
          {response.top_3_fixes.map((fix, i) => (
            <li key={i} className="list-disc text-sm text-slate-700">
              {fix}
            </li>
          ))}
        </ul>
      )}

      {/* Suggested next action */}
      {response.suggested_next_action && (
        <p className="mt-3 rounded-lg px-3 py-2 text-sm font-medium" style={{ backgroundColor: '#7C3AED18', color: '#7C3AED' }}>
          {response.suggested_next_action}
        </p>
      )}

      {/* Copy button */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={onCopy}
          data-testid="copy-button"
          className="rounded px-3 py-1 text-xs font-medium text-slate-500 border border-slate-200 hover:bg-slate-50"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// ExchangeCard — renders a single agent response
// --------------------------------------------------------------------------

function ExchangeCard({ exchange, isPreLoaded }: { exchange: AgentResponse; isPreLoaded?: boolean }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = [
      exchange.llm_response.summary_sentence,
      exchange.llm_response.score_breakdown,
      ...(exchange.llm_response.top_3_fixes ?? []),
      exchange.llm_response.suggested_next_action,
    ]
      .filter(Boolean)
      .join('\n\n');
    navigator.clipboard?.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mb-4" data-testid="exchange-card">
      {/* User query bubble */}
      <div className="mb-2 flex justify-end">
        <div
          className="max-w-sm rounded-xl px-4 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: '#2D1BB5' }}
          data-testid="user-query-bubble"
        >
          {exchange.query}
        </div>
      </div>

      {/* Agent response area */}
      <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid="agent-response">
        {isPreLoaded && (
          <span className="mb-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium text-slate-400 bg-slate-100">
            Example response
          </span>
        )}

        {exchange.error ? (
          <p className="text-sm text-red-600" data-testid="agent-error">
            {exchange.llm_response.summary_sentence}
          </p>
        ) : (
          <>
            <PlainEnglishAnswer
              response={exchange.llm_response}
              onCopy={handleCopy}
            />
            {copied && (
              <p className="mt-1 text-right text-xs text-slate-400">Copied!</p>
            )}
            <ReasoningTracePanel trace={exchange.reasoning_trace} />
          </>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// NLChat
// --------------------------------------------------------------------------

export default function NLChat({ prsState }: NLChatProps) {
  // Pre-loaded exchange rendered immediately — no useEffect API call (FR-005-19).
  const [exchanges, setExchanges] = useState<AgentResponse[]>([PRE_LOADED_EXCHANGE as AgentResponse]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [retryQuery, setRetryQuery] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function submitQuery(query: string) {
    if (!query.trim()) return;
    setIsLoading(true);
    setRetryQuery(null);
    setInputText('');

    try {
      const response = await handleQuery(query, prsState) as AgentResponse;
      setExchanges(prev => [...prev, response]);
      if (response.error) {
        setRetryQuery(query);
      }
    } catch {
      const errorResponse: AgentResponse = {
        query,
        intent: 'diagnosis',
        reasoning_trace: [],
        llm_response: {
          summary_sentence: 'Agent is temporarily unavailable. Please try again.',
          score_breakdown: '',
          top_3_fixes: [],
          suggested_next_action: '',
        },
        timestamp: new Date().toISOString(),
        error: true,
        error_message: 'Unknown error',
      };
      setExchanges(prev => [...prev, errorResponse]);
      setRetryQuery(query);
    } finally {
      setIsLoading(false);
      // Scroll to bottom on next frame.
      requestAnimationFrame(() =>
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' }),
      );
    }
  }

  function handleChipClick(chip: string) {
    submitQuery(chip);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitQuery(inputText);
  }

  function handleRetry() {
    if (retryQuery) submitQuery(retryQuery);
  }

  return (
    <div
      className="flex flex-col p-6 max-w-3xl mx-auto h-full"
      data-testid="nl-chat"
    >
      {/* ── Exchange history ── */}
      <div className="flex-1 overflow-y-auto mb-4 space-y-2" data-testid="exchange-history">
        {exchanges.map((ex, idx) => (
          <ExchangeCard
            key={idx}
            exchange={ex}
            isPreLoaded={idx === 0}
          />
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4"
            data-testid="loading-indicator"
          >
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-teal-600" style={{ borderTopColor: '#7C3AED' }} />
            <p className="text-sm text-slate-600">Consulting Bloomreach data...</p>
          </div>
        )}

        {/* Retry button (only on error) */}
        {retryQuery && !isLoading && (
          <div className="flex justify-center">
            <button
              onClick={handleRetry}
              data-testid="retry-button"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Retry
            </button>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick-action chips ── */}
      {!isLoading && (
        <div className="mb-3 flex flex-wrap gap-2" data-testid="quick-action-chips">
          {QUICK_ACTION_CHIPS.map((chip) => (
            <button
              key={chip}
              onClick={() => handleChipClick(chip)}
              data-testid={`chip-${chip.slice(0, 20).replace(/\s/g, '-')}`}
              className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-teal-500 hover:text-teal-700 transition-colors"
            >
              {chip}
            </button>
          ))}
        </div>
      )}

      {/* ── Input form ── */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2"
        data-testid="nl-chat-form"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          placeholder="Ask about your personalisation..."
          disabled={isLoading}
          data-testid="chat-input"
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          data-testid="ask-button"
          className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-1"
          style={{ backgroundColor: '#7C3AED' }}
        >
          Ask
        </button>
      </form>
    </div>
  );
}
