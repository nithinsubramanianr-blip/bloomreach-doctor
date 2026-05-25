import { render, screen, fireEvent } from '@testing-library/react';
import BeforeAfterToggle from '../../src/m5-plp/components/BeforeAfterToggle';

describe('BeforeAfterToggle', () => {
  test('clicking After calls onChange with "after"', () => {
    const onChange = jest.fn();
    render(<BeforeAfterToggle value="before" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /after/i }));
    expect(onChange).toHaveBeenCalledWith('after');
  });

  test('clicking Before calls onChange with "before"', () => {
    const onChange = jest.fn();
    render(<BeforeAfterToggle value="after" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /before/i }));
    expect(onChange).toHaveBeenCalledWith('before');
  });

  test('aria-pressed reflects the active value', () => {
    render(<BeforeAfterToggle value="after" onChange={() => undefined}/>);
    expect(
      screen.getByRole('button', { name: /after/i }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: /before/i }).getAttribute('aria-pressed'),
    ).toBe('false');
  });
});
