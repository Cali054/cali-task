import Image from "next/image";
import { cn } from "@/lib/utils";

/** Intrinsic sizes of the files in /public/brand (see design/logo/build_brand_assets.py). */
const LOCKUP = { width: 1065, height: 418 };
const EMBLEM = { width: 562, height: 418 };

const widthFor = (size: { width: number; height: number }, height: number) =>
  Math.round((height * size.width) / size.height);

/** Single-colour logo: the file is used as a mask, so it takes the current text colour. */
function MonoMark({ src, width, height, className }: { src: string; width: number; height: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label="Cali"
      className={cn("block shrink-0 bg-current", className)}
      style={{
        width,
        height,
        maskImage: `url(${src})`,
        WebkitMaskImage: `url(${src})`,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
      }}
    />
  );
}

/**
 * Emblem only. Height sets the size; width always follows the logo's proportions.
 * `float` and `glow` add the brand's idle animation and ambient light.
 */
export function CaliLogoIcon({
  size = 40,
  variant = "gradient",
  float,
  glow,
  priority,
  className,
}: {
  size?: number;
  variant?: "gradient" | "mono";
  float?: boolean;
  glow?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const width = widthFor(EMBLEM, size);
  return (
    <span className={cn("relative inline-block shrink-0", float && "cali-float", className)} style={{ width, height: size }}>
      {glow && <span aria-hidden className="cali-glow absolute inset-[-25%] rounded-full" />}
      {variant === "mono" ? (
        <MonoMark src="/brand/cali-emblem-mono.png" width={width} height={size} />
      ) : (
        <Image src="/brand/cali-emblem.png" alt="Cali" width={width} height={size} priority={priority} className="relative block" />
      )}
    </span>
  );
}

/**
 * Full logo: emblem + wordmark, positioned exactly as in the source artwork.
 * - `primary` follows the theme (dark wordmark in light mode, light wordmark in dark mode).
 * - `tone` forces one wordmark for surfaces that don't follow the theme.
 * - `mono` is one colour, inherited from the surrounding text colour.
 */
export function CaliLogo({
  height = 40,
  variant = "primary",
  tone = "auto",
  tagline,
  align = "start",
  priority,
  className,
}: {
  height?: number;
  variant?: "primary" | "mono";
  tone?: "auto" | "on-light" | "on-dark";
  tagline?: boolean;
  align?: "start" | "center";
  priority?: boolean;
  className?: string;
}) {
  const width = widthFor(LOCKUP, height);
  const image = (src: string, cls?: string) => (
    <Image src={src} alt="Cali" width={width} height={height} priority={priority} className={cn("block", cls)} />
  );

  return (
    <span className={cn("inline-flex flex-col", align === "center" ? "items-center" : "items-start", className)}>
      {variant === "mono" ? (
        <MonoMark src="/brand/cali-logo-primary-mono.png" width={width} height={height} />
      ) : tone === "on-light" ? (
        image("/brand/cali-logo-primary.png")
      ) : tone === "on-dark" ? (
        image("/brand/cali-logo-primary-light.png")
      ) : (
        <>
          {image("/brand/cali-logo-primary.png", "dark:hidden")}
          {image("/brand/cali-logo-primary-light.png", "hidden dark:block")}
        </>
      )}
      {tagline && (
        <span className="mt-2 whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.28em] text-fg-3">
          Plan. Track. Complete.
        </span>
      )}
    </span>
  );
}

/** Calm loading state built on the emblem. Fades in late so quick loads never flash it. */
export function CaliLoadingIndicator({
  size = 56,
  fullscreen,
  label = "Loading",
  className,
}: {
  size?: number;
  fullscreen?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      className={cn("cali-loading grid place-items-center", fullscreen && "fixed inset-0 z-10", className)}
    >
      <CaliLogoIcon size={size} float glow />
      <span className="sr-only">{label}</span>
    </div>
  );
}
