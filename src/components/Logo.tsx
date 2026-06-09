import type { CSSProperties } from 'react';

/**
 * Hunor Coop hivatalos logó (a public/hunor-coop-logo.png fájlból).
 * A `size` a logó magassága pixelben; a szélesség arányosan igazodik.
 */
export function Logo({
  size = 44,
  className,
  style,
}: {
  size?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/hunor-coop-logo.jpg"
      alt="Hunor Coop"
      className={className}
      style={{ height: size, width: 'auto', ...style }}
    />
  );
}
