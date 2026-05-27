import { useState } from 'react';
import type { DiscoveryProduct } from '../lib/resultCache';

/**
 * ProductCard
 *
 * Single product tile. Renders the "Personalised for you" badge ONLY when
 *   - displayState === 'after'   AND
 *   - rankPosition <= 3
 *
 * Spec: 006-react-plp / FR-006-11, FR-006-12, FR-006-14
 */

interface ProductCardProps {
  product: DiscoveryProduct;
  rankPosition: number; // 1-based
  displayState: 'before' | 'after';
}

function formatPrice(price: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

export default function ProductCard({
  product,
  rankPosition,
  displayState,
}: ProductCardProps) {
  const [imgError, setImgError] = useState(false);
  const showBadge = displayState === 'after' && rankPosition <= 3;

  return (
    <article
      data-testid="product-card"
      data-rank={rankPosition}
      data-state={displayState}
      className="relative flex h-[280px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
    >
      {showBadge ? (
        <span
          data-testid="personalised-badge"
          className="absolute left-2 top-2 z-10 rounded-full bg-ppd-teal px-2 py-0.5 text-xs font-semibold text-white shadow"
        >
          Personalised for you
        </span>
      ) : null}

      <div className="flex flex-1 items-center justify-center bg-slate-100">
        {product.image_url && !imgError ? (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={product.image_url}
            alt={product.name}
            onError={() => setImgError(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-sm text-slate-400"
          >
            {product.category ?? 'Jewellery'}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1 px-3 py-2">
        <span className="line-clamp-2 text-sm font-medium text-ppd-navy">
          {product.name}
        </span>
        <span className="text-sm font-semibold text-slate-900">
          {formatPrice(product.price, product.currency)}
        </span>
        {product.category ? (
          <span className="text-xs uppercase tracking-wide text-slate-500">
            {product.category}
          </span>
        ) : null}
      </div>
    </article>
  );
}
