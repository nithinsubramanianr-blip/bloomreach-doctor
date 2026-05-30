import ProductCard from './ProductCard';
import type { DiscoveryProduct } from '../lib/resultCache';

/**
 * ProductGrid
 *
 *   products === null → 8 skeleton cards (loading state)
 *   products === []   → 8 skeleton cards + console.warn (never render empty)
 *   otherwise         → ProductCard per item, 4 cols desktop / 2 cols mobile
 *
 * Spec: 006-react-plp / FR-006-10, FR-006-21, Edge cases
 */

interface ProductGridProps {
  products: DiscoveryProduct[] | null;
  displayState?: 'before' | 'after';
}

const SKELETON_COUNT = 8;

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      data-testid="skeleton-card"
      data-index={index}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="aspect-square w-full animate-pulse bg-slate-200" />
      <div className="space-y-2 px-3.5 py-3">
        <div className="h-2 w-12 animate-pulse rounded bg-slate-200" />
        <div className="h-3.5 w-3/4 animate-pulse rounded bg-slate-200" />
        <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function ProductGrid({
  products,
  displayState = 'after',
}: ProductGridProps) {
  if (products === null || products.length === 0) {
    if (products && products.length === 0) {
      // eslint-disable-next-line no-console
      console.warn(
        '[M5 ProductGrid] product list empty — rendering skeleton placeholders',
      );
    }
    return (
      <div
        data-testid="product-grid"
        data-loading="true"
        className="grid grid-cols-2 gap-4 md:grid-cols-4"
      >
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <SkeletonCard key={`skeleton-${i}`} index={i} />
        ))}
      </div>
    );
  }

  return (
    <div
      data-testid="product-grid"
      data-loading="false"
      className="grid grid-cols-2 gap-4 md:grid-cols-4"
    >
      {products.map((product, idx) => (
        <ProductCard
          key={product.product_id ?? `p-${idx}`}
          product={product}
          rankPosition={idx + 1}
          displayState={displayState}
        />
      ))}
    </div>
  );
}
