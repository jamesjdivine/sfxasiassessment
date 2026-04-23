/**
 * SnowFox logo.
 *
 * There are two modes:
 *   1. If you've placed the official PNG at `/brand/snowfox-horizontal.png` or
 *      `/brand/snowfox-stacked.png` (see /public/brand/README.md), this
 *      component renders that image.
 *   2. Otherwise it falls back to an inline SVG approximation of the 8-point
 *      snowflake mark + "SNOWFOX" wordmark so the site still looks on-brand.
 *
 * Toggle `useImageAsset` once the real PNG has been dropped in.
 */

interface Props {
  variant?: "horizontal" | "stacked" | "mark";
  className?: string;
}

// Flip to true once /public/brand/snowfox-*.png files are in place.
const useImageAsset = false;

export default function SnowfoxLogo({ variant = "horizontal", className = "" }: Props) {
  if (useImageAsset) {
    const src =
      variant === "stacked"
        ? "/brand/snowfox-stacked.png"
        : "/brand/snowfox-horizontal.png";
    return (
      <img
        src={src}
        alt="SnowFox Solutions"
        className={className}
        width={variant === "stacked" ? 180 : 240}
        height={variant === "stacked" ? 180 : 48}
      />
    );
  }

  if (variant === "mark") {
    return <SnowflakeMark className={className} />;
  }

  if (variant === "stacked") {
    return (
      <div className={`inline-flex flex-col items-center gap-2 ${className}`}>
        <SnowflakeMark className="h-16 w-16" />
        <Wordmark className="h-6" />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <SnowflakeMark className="h-8 w-8" />
      <Wordmark className="h-5" />
    </div>
  );
}

function SnowflakeMark({ className = "" }: { className?: string }) {
  // Stylized 8-point snowflake approximating the SnowFox mark.
  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g fill="currentColor">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((rot) => (
          <polygon
            key={rot}
            points="50,8 58,35 50,50 42,35"
            transform={`rotate(${rot} 50 50)`}
          />
        ))}
        <polygon points="50,42 56,50 50,58 44,50" />
      </g>
    </svg>
  );
}

function Wordmark({ className = "" }: { className?: string }) {
  // "SNOWFOX" wordmark with the small crimson accent on the X (as in the logo).
  return (
    <svg
      viewBox="0 0 220 36"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="SnowFox"
    >
      <text
        x="0"
        y="28"
        fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
        fontWeight="800"
        fontSize="30"
        letterSpacing="-0.5"
        fill="currentColor"
      >
        SNOWFOX
      </text>
      {/* Crimson accent on top-right of the X */}
      <polygon points="210,6 218,2 214,12" fill="#E63946" />
    </svg>
  );
}
