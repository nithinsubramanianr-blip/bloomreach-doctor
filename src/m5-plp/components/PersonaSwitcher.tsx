"use client";

import type { Persona, PersonaId } from "@/lib/contracts";

/**
 * Persona dropdown. On change it manages the `_br_uid_2` cookie exactly per
 * design-spec 006: always clear the cookie first, then set the new value —
 * EXCEPT for Guest, whose cookie must be deleted (not set to empty string).
 */

function personaLabel(p: Persona): string {
  // guest -> "Guest (New Prospecting)"; others -> "Sarah — Gifting".
  return p.persona_id === "guest"
    ? `${p.display_name} (${p.archetype_name})`
    : `${p.display_name} — ${p.archetype_name}`;
}

function applyBruidCookie(persona: Persona): void {
  // 1. Clear any existing cookie (all personas).
  document.cookie =
    "_br_uid_2=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  // 2. Set the new cookie only when the persona has a BRUID (not Guest).
  if (persona.bruid_value !== null) {
    document.cookie = `${persona.bruid_value}; path=/`;
  }
}

interface PersonaSwitcherProps {
  personas: Persona[];
  activePersonaId: PersonaId;
  onChange: (personaId: PersonaId) => void;
}

export function PersonaSwitcher({
  personas,
  activePersonaId,
  onChange,
}: PersonaSwitcherProps) {
  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = personas.find((p) => p.persona_id === event.target.value);
    if (!next) return;
    applyBruidCookie(next);
    onChange(next.persona_id);
  }

  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span className="hidden sm:inline opacity-80">Viewing as</span>
      <select
        aria-label="Persona"
        value={activePersonaId}
        onChange={handleChange}
        className="rounded-md border border-white/30 bg-white px-3 py-1.5 text-navy font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-teal"
      >
        {personas.map((p) => (
          <option key={p.persona_id} value={p.persona_id}>
            {personaLabel(p)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default PersonaSwitcher;
