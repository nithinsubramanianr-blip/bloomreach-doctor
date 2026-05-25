import { render, screen } from '@testing-library/react';
import ProductGrid from '../../src/m5-plp/components/ProductGrid';
import type { DiscoveryProduct } from '../../src/m5-plp/lib/resultCache';

const SAMPLE: DiscoveryProduct[] = [
  { product_id: 'P001', name: 'A', price: 10, currency: 'GBP' },
  { product_id: 'P002', name: 'B', price: 20, currency: 'GBP' },
  { product_id: 'P003', name: 'C', price: 30, currency: 'GBP' },
  { product_id: 'P004', name: 'D', price: 40, currency: 'GBP' },
  { product_id: 'P005', name: 'E', price: 50, currency: 'GBP' },
];

describe('ProductGrid', () => {
  test('renders 8 skeleton cards while loading (products === null)', () => {
    render(<ProductGrid products={null} displayState="before" />);
    expect(screen.getAllByTestId('skeleton-card')).toHaveLength(8);
    expect(screen.getByTestId('product-grid').getAttribute('data-loading')).toBe(
      'true',
    );
  });

  test('renders skeleton cards (never empty) when products is an empty array', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(<ProductGrid products={[]} displayState="after" />);
    expect(screen.getAllByTestId('skeleton-card')).toHaveLength(8);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  test('renders ProductCard per item when populated', () => {
    render(<ProductGrid products={SAMPLE} displayState="before" />);
    expect(screen.getAllByTestId('product-card')).toHaveLength(SAMPLE.length);
  });

  test('"Personalised for you" badge: visible on rank 1–3 in After state only', () => {
    const { rerender } = render(
      <ProductGrid products={SAMPLE} displayState="before" />,
    );
    expect(screen.queryAllByTestId('personalised-badge')).toHaveLength(0);

    rerender(<ProductGrid products={SAMPLE} displayState="after" />);
    const badges = screen.queryAllByTestId('personalised-badge');
    expect(badges).toHaveLength(3); // top 3 ranks
  });

  test('badge appears on the first 3 cards specifically', () => {
    render(<ProductGrid products={SAMPLE} displayState="after" />);
    const cards = screen.getAllByTestId('product-card');
    // Top 3 should each contain a personalised-badge child.
    cards.slice(0, 3).forEach((card) => {
      expect(card.querySelector('[data-testid="personalised-badge"]')).not.toBeNull();
    });
    // Ranks 4+ should NOT contain a badge.
    cards.slice(3).forEach((card) => {
      expect(card.querySelector('[data-testid="personalised-badge"]')).toBeNull();
    });
  });
});
