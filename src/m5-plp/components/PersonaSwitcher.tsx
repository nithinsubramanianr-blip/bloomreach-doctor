"use client";

import type { Persona, PersonaId } from "@/lib/contracts";

function personaLabel(p: Persona): string {
  return p.persona_id === "guest"
    ? `${p.display_name} (${p.archetype_name})`
    : `${p.display_name} — ${p.archetype_name}`;
}

function applyBruidCookie(persona: Persona): void {
  document.cookie =
    "_br_uid_2=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
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
    <label className="flex min-w-0 flex-1 items-center gap-2 text-[12px] text-header-muted sm:flex-none">
      <span className="hidden sm:inline">Viewing as</span>
      <select
        aria-label="Persona"
        value={activePersonaId}
        onChange={handleChange}
        className="min-w-0 max-w-full flex-1 truncate rounded-full border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12px] font-medium text-header-text focus:border-accent focus:outline-none sm:max-w-none sm:flex-none sm:px-3 sm:text-[13px]"
      >
        {personas.map((p) => (
          <option key={p.persona_id} value={p.persona_id} className="text-text">
            {personaLabel(p)}
          </option>
        ))}
      </select>
    </label>
  );
}

export default PersonaSwitcher;
