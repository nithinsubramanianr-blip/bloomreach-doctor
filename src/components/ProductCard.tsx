"use client";

import { useState } from "react";

import type { Affinity, DemoState, DiscoveryProduct } from "@/lib/contracts";
import { CategoryIcon } from "./CategoryIcon";

export type RankChange = "up" | "down" | "same";

const AFFINITY_LABEL: Record<Affinity, string> = {
  gift: "Gift set",
  premium: "Premium",
  bestseller: "Bestseller",
};

const AFFINITY_CLASS: Record<Affinity, string> = {
  gift: "bg-accent-soft text-accent",
  premium: "bg-surface-2 text-text ring-1 ring-border-strong",
  bestseller: "bg-surface-2 text-muted ring-1 ring-border",
};

interface ProductCardProps {
  product: DiscoveryProduct;
  displayState: DemoState;
  rankChange?: RankChange;
  index?: number;
}

/** Stable 32-bit hash so each product id maps to the same tile every render. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * Deterministic, swap-ready product tile: a two-tone gradient derived from the
 * product id. No external or copyrighted imagery — drop a real file at
 * `image_url` and it overlays the gradient automatically.
 */
function tileStyle(productId: string): React.CSSProperties {
  const h = hashId(productId);
  const hue1 = h % 360;
  const hue2 = (hue1 + 35 + (h % 50)) % 360;
  return {
    backgroundImage: `linear-gradient(135deg, hsl(${hue1} 42% 74%), hsl(${hue2} 48% 58%))`,
  };
}

function ProductImage({ product }: { product: DiscoveryProduct }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showImage = product.image_url && !errored;

  return (
    <div
      className="relative flex h-32 items-center justify-center overflow-hidden max-md:h-28"
      style={tileStyle(product.product_id)}
    >
      <CategoryIcon
        category={product.category}
        className="h-20 w-20 text-white/85 drop-shadow-sm max-md:h-16 max-md:w-16"
      />
      {showImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
            loaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </div>
  );
}

export function ProductCard({
  product,
  displayState,
  rankChange,
  index = 0,
}: ProductCardProps) {
  const isAfter = displayState === "after";
  const personalised = isAfter && product.is_personalised;

  return (
    <div
      className={`animate-rise relative overflow-hidden rounded-xl border bg-surface transition-shadow hover:shadow-panel ${
        personalised ? "border-accent/50 ring-1 ring-accent/20" : "border-border"
      }`}
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="relative">
        <ProductImage product={product} />

        <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-md bg-surface/90 px-2 py-1 text-[11px] font-semibold text-text shadow-sm backdrop-blur">
          #{product.rank_position}
          {isAfter && rankChange === "up" && (
            <span className="text-green">↑</span>
          )}
          {isAfter && rankChange === "down" && (
            <span className="text-faint">↓</span>
          )}
          {isAfter && rankChange === "same" && (
            <span className="text-faint">–</span>
          )}
        </span>

        {personalised && (
          <span className="absolute right-2.5 top-2.5 rounded-md bg-accent px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-ink">
            For you
          </span>
        )}
      </div>

      <div className="px-3.5 pb-3.5 pt-3">
        <h3 className="min-h-[34px] text-[13px] font-medium leading-snug text-text max-md:line-clamp-2 max-md:min-h-[2.5rem] max-md:text-[12px]">
          {product.name}
        </h3>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <span className="text-[15px] font-semibold text-text max-md:text-[14px]">
            £{product.price.toFixed(2)}
          </span>
          {product.affinity && (
            <span
              className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${AFFINITY_CLASS[product.affinity]}`}
            >
              {AFFINITY_LABEL[product.affinity]}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
