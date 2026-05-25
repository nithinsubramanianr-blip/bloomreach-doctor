import { render, screen, fireEvent } from '@testing-library/react';
import PersonaSwitcher, {
  applyPersonaCookie,
  type PersonaOption,
} from '../../src/m5-plp/components/PersonaSwitcher';

const PERSONAS: PersonaOption[] = [
  { persona_id: 'guest', display_name: 'Guest', bruid_value: null },
  {
    persona_id: 'sarah',
    display_name: 'Sarah',
    bruid_value: '_br_uid_2=sarah-gifting-demo-001',
  },
  {
    persona_id: 'alex',
    display_name: 'Alex',
    bruid_value: '_br_uid_2=alex-highvalue-demo-002',
  },
];

function getCookieValue(name: string): string | null {
  const cookies = document.cookie.split(';').map((c) => c.trim());
  const match = cookies.find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  return value;
}

function clearAllCookies() {
  document.cookie =
    '_br_uid_2=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/';
}

describe('PersonaSwitcher cookie management', () => {
  beforeEach(() => {
    clearAllCookies();
  });

  test('switching to Sarah sets the correct _br_uid_2 cookie value', () => {
    const handleChange = jest.fn();
    render(
      <PersonaSwitcher
        personas={PERSONAS}
        activePersonaId="guest"
        onChange={handleChange}
      />,
    );

    fireEvent.change(screen.getByTestId('persona-switcher'), {
      target: { value: 'sarah' },
    });

    expect(handleChange).toHaveBeenCalledWith('sarah');
    expect(getCookieValue('_br_uid_2')).toBe('sarah-gifting-demo-001');
  });

  test('switching to Alex sets the correct _br_uid_2 cookie value', () => {
    render(
      <PersonaSwitcher
        personas={PERSONAS}
        activePersonaId="guest"
        onChange={() => undefined}
      />,
    );

    fireEvent.change(screen.getByTestId('persona-switcher'), {
      target: { value: 'alex' },
    });

    expect(getCookieValue('_br_uid_2')).toBe('alex-highvalue-demo-002');
  });

  test('switching TO Guest deletes the _br_uid_2 cookie (no cookie set)', () => {
    // Pre-seed a Sarah cookie so we can confirm deletion (not empty-string).
    applyPersonaCookie(PERSONAS[1]);
    expect(getCookieValue('_br_uid_2')).toBe('sarah-gifting-demo-001');

    render(
      <PersonaSwitcher
        personas={PERSONAS}
        activePersonaId="sarah"
        onChange={() => undefined}
      />,
    );

    fireEvent.change(screen.getByTestId('persona-switcher'), {
      target: { value: 'guest' },
    });

    // After switching to Guest, cookie must be deleted entirely (jsdom drops
    // an expired cookie from document.cookie), NOT set to empty string.
    expect(getCookieValue('_br_uid_2')).toBeNull();
  });

  test('applyPersonaCookie helper deletes cookie for null bruid_value', () => {
    applyPersonaCookie(PERSONAS[1]); // Sarah → sets cookie
    expect(getCookieValue('_br_uid_2')).toBe('sarah-gifting-demo-001');

    applyPersonaCookie(PERSONAS[0]); // Guest → clears
    expect(getCookieValue('_br_uid_2')).toBeNull();
  });
});
