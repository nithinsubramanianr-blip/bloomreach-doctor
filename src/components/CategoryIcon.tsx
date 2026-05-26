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
        <svg {...common} strokeLinecap="round" strokeLinejoin="round">
          {/* a clear pair of stud-and-drop earrings */}
          <circle cx="18" cy="13" r="1.6" />
          <path d="M18 15c-4 4-4 9 0 12 4-3 4-8 0-12z" />
          <circle cx="30" cy="13" r="1.6" />
          <path d="M30 15c-4 4-4 9 0 12 4-3 4-8 0-12z" />
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
