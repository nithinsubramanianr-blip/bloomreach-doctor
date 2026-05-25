import { ChangeEvent } from 'react';

/**
 * PersonaSwitcher
 *
 * Dropdown with the three demo personas. Owns BRUID cookie management:
 *   - Every switch clears the existing `_br_uid_2` cookie.
 *   - If the new persona has a non-null bruid_value, the cookie is then set.
 *   - For Guest the cookie remains deleted (not set to empty string).
 *
 * Spec: 006-react-plp / FR-006-7, FR-006-8, ADR-006-2
 */

export interface PersonaOption {
  persona_id: string;
  display_name: string;
  archetype_name?: string;
  bruid_value: string | null;
}

interface PersonaSwitcherProps {
  personas: PersonaOption[];
  activePersonaId: string;
  onChange: (personaId: string) => void;
}

const CLEAR_COOKIE =
  '_br_uid_2=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';

export function applyPersonaCookie(persona: PersonaOption): void {
  if (typeof document === 'undefined') return;
  // 1) Always clear first.
  document.cookie = CLEAR_COOKIE;
  // 2) Set only if persona carries a BRUID value (Sarah, Alex). Guest stays cleared.
  if (persona.bruid_value !== null && persona.bruid_value !== undefined) {
    document.cookie = `${persona.bruid_value}; path=/`;
  }
}

export default function PersonaSwitcher({
  personas,
  activePersonaId,
  onChange,
}: PersonaSwitcherProps) {
  const handleChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const nextId = e.target.value;
    const persona = personas.find((p) => p.persona_id === nextId);
    if (!persona) return;
    applyPersonaCookie(persona);
    onChange(nextId);
  };

  const labelFor = (p: PersonaOption) => {
    if (p.persona_id === 'guest') return 'Guest (New Prospecting)';
    if (p.persona_id === 'sarah') return 'Sarah — Gifting';
    if (p.persona_id === 'alex') return 'Alex — High Value Returning';
    return p.display_name;
  };

  return (
    <label className="flex items-center gap-2 text-sm text-white">
      <span className="font-medium">Persona</span>
      <select
        aria-label="Persona selector"
        data-testid="persona-switcher"
        value={activePersonaId}
        onChange={handleChange}
        className="rounded-md border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-ppd-teal"
      >
        {personas.map((p) => (
          <option key={p.persona_id} value={p.persona_id} className="text-black">
            {labelFor(p)}
          </option>
        ))}
      </select>
    </label>
  );
}
