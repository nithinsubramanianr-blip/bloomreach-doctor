/**
 * Line-art category icons used as the tasteful product-photography placeholder
 * (matching module-b-mock.html). Stroke inherits `currentColor`.
 */
export function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const common = {
    viewBox: "0 0 48 48",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    className,
  } as const;

  switch (category) {
    case "earrings":
      return (
        <svg {...common} strokeLinecap="round">
          <path d="M18 12a4 4 0 0 1 8 0c0 5-5 6-5 11" />
          <circle cx="21" cy="31" r="3.5" />
          <path d="M30 14a3 3 0 0 1 6 0c0 4-4 5-4 9" />
          <circle cx="33" cy="29" r="3" />
        </svg>
      );
    case "bracelet":
    case "ring":
      return (
        <svg {...common}>
          <ellipse cx="24" cy="24" rx="15" ry="11" />
          <path d="M19 13l5-4 5 4" strokeLinecap="round" />
        </svg>
      );
    case "necklace":
    default:
      return (
        <svg {...common} strokeLinecap="round">
          <path d="M8 12c4 11 12 16 16 16s12-5 16-16" />
          <circle cx="24" cy="33" r="4" />
        </svg>
      );
  }
}

export default CategoryIcon;
