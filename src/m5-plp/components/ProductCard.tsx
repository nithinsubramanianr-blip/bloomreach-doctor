import type { DemoState, DiscoveryProduct } from "@/lib/contracts";

/**
 * Single product tile. Images are placeholder paths that don't exist, so a grey
 * box is rendered instead (design-spec 001 edge case). The "Personalised for
 * you" badge shows only on the top 3 products in the "after" state.
 */

interface ProductCardProps {
  product: DiscoveryProduct;
  displayState: DemoState;
}

export function ProductCard({ product, displayState }: ProductCardProps) {
  const personalised =
    displayState === "after" && product.rank_position <= 3;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm">
      {/* Rank badge */}
      <span className="absolute left-2 top-2 z-10 rounded-full bg-navy/90 px-2 py-0.5 text-xs font-semibold text-white">
        #{product.rank_position}
      </span>

      {personalised && (
        <span className="absolute right-2 top-2 z-10 rounded-full bg-teal px-2 py-0.5 text-[11px] font-semibold text-white">
          Personalised for you
        </span>
      )}

      {/* Grey image placeholder */}
      <div className="flex h-40 w-full items-center justify-center bg-gray-200 text-gray-400">
        <span className="text-xs">{product.category}</span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-navy">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-sm font-semibold text-navy">
            £{product.price.toFixed(2)}
          </span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-gray-500">
            {product.category}
          </span>
        </div>
      </div>
    </div>
  );
}

export default ProductCard;
