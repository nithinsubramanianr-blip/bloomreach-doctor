import { useState } from 'react';
import type { DiscoveryProduct } from '../lib/resultCache';

/**
 * ProductCard — modern e-commerce layout.
 *
 * Renders ONLY the fields the Discovery doc actually returns. No hard-coded
 * category text, no "Untitled product" filler, no fake affinity badges.
 *
 *   • Image with hover zoom + gradient fallback when thumb_image is missing
 *   • Rank pill (top-left) — drives the "ranked #N" demo storytelling
 *   • "For you" pill (top-right) — only when AFTER + product.is_personalised
 *   • Brand · Name · Price (with strikethrough sale_price when present)
 *   • Affinity tag (gift_eligible / is_new_arrival / price_band=premium /
 *     is_bestseller) — surfaced ONLY when the doc carries the flag
 *   • Subtle "Add to bag" CTA on hover
 */

interface ProductCardProps {
  product: DiscoveryProduct;
  rankPosition: number; // 1-based
  displayState: 'before' | 'after';
}

function formatPrice(price: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${currency} ${price.toFixed(2)}`;
  }
}

/** Stable 32-bit hash → maps product_id to a deterministic tile gradient. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

function gradientFromId(productId: string): React.CSSProperties {
  const h = hashId(productId || 'fallback');
  const hue1 = h % 360;
  const hue2 = (hue1 + 38 + (h % 40)) % 360;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hue1} 55% 78%), hsl(${hue2} 65% 60%))`,
  };
}

/** Returns the first affinity flag present on the doc, or null. */
function pickAffinity(product: DiscoveryProduct):
  | { label: string; tone: 'gift' | 'premium' | 'new' | 'best' }
  | null {
  if (product.gift_eligible) return { label: 'Gift', tone: 'gift' };
  if (product.price_band === 'premium') return { label: 'Premium', tone: 'premium' };
  if (product.is_new_arrival) return { label: 'New', tone: 'new' };
  if (product.is_bestseller) return { label: 'Bestseller', tone: 'best' };
  return null;
}

const AFFINITY_CLASSES: Record<'gift' | 'premium' | 'new' | 'best', string> = {
  gift:    'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
  premium: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  new:     'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  best:    'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
};

export default function ProductCard({
  product,
  rankPosition,
  displayState,
}: ProductCardProps) {
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);

  const isAfter = displayState === 'after';
  const personalised = isAfter && product.is_personalised;
  const onSale =
    typeof product.sale_price === 'number'
      && typeof product.list_price === 'number'
      && product.sale_price < product.list_price;
  const affinity = pickAffinity(product);

  return (
    <article
      data-testid="product-card"
      data-rank={rankPosition}
      data-state={displayState}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg ${
        personalised ? 'border-violet-300 ring-1 ring-violet-200' : 'border-slate-200'
      }`}
    >
      {/* ── Image area ── */}
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={gradientFromId(product.product_id)}
      >
        {/* Image — fades in on load; falls through to gradient on error */}
        {product.image_url && !imgError && (
          // eslint-disable-next-line jsx-a11y/img-redundant-alt
          <img
            src={product.image_url}
            alt={product.name || 'Product image'}
            loading="lazy"
            onLoad={() => setImgLoaded(true)}
            onError={() => setImgError(true)}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-500 group-hover:scale-105 ${
              imgLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/* Rank pill */}
        <span
          data-testid="rank-badge"
          className="absolute left-2.5 top-2.5 inline-flex items-center rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-sm backdrop-blur"
        >
          #{rankPosition}
        </span>

        {/* For-you pill (AFTER + personalised only) */}
        {personalised && (
          <span
            data-testid="personalised-badge"
            className="absolute right-2.5 top-2.5 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow"
            style={{ backgroundColor: '#7C3AED' }}
          >
            For you
          </span>
        )}

        {/* Sale ribbon */}
        {onSale && (
          <span className="absolute bottom-2.5 left-2.5 inline-flex items-center rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
            Sale
          </span>
        )}

        {/* Add to bag — appears on hover */}
        <button
          type="button"
          className="absolute inset-x-3 bottom-3 translate-y-12 rounded-lg bg-slate-900/90 px-3 py-2 text-xs font-semibold text-white opacity-0 backdrop-blur transition-all duration-200 hover:bg-slate-900 group-hover:translate-y-0 group-hover:opacity-100"
          onClick={(e) => {
            e.preventDefault();
            // Demo-only — no real cart wired up.
          }}
        >
          Add to bag
        </button>
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 flex-col gap-1.5 px-3.5 py-3">
        {product.brand && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            {product.brand}
          </span>
        )}

        {product.name && (
          <h3 className="line-clamp-2 min-h-[2.4rem] text-sm font-medium leading-snug text-slate-900">
            {product.name}
          </h3>
        )}

        <div className="mt-auto flex items-end justify-between gap-2 pt-1.5">
          <div className="flex items-baseline gap-2">
            <span className="text-base font-semibold text-slate-900">
              {formatPrice(product.price, product.currency)}
            </span>
            {onSale && product.list_price && (
              <span className="text-xs text-slate-400 line-through">
                {formatPrice(product.list_price, product.currency)}
              </span>
            )}
          </div>

          {affinity && (
            <span
              data-testid="affinity-badge"
              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${AFFINITY_CLASSES[affinity.tone]}`}
            >
              {affinity.label}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
