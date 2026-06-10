'use client';

import { useEffect, useState } from 'react';

/**
 * Táblagépeken (érintős eszköz, álló tájolás) a teljes tartalmat CSS-sel
 * elforgatja fekvő (landscape) helyzetbe — így akkor is vízszintesen jelenik
 * meg, ha a tabletet álló helyzetben tartják. Asztali gépeken (egér) nincs hatás.
 *
 * A `transform` miatt a wrapper lesz a fixált (position:fixed) elemek
 * tartalmazó blokkja, így a modálok/fejléc is vele együtt forognak.
 */
export function LandscapeFrame({ children }: { children: React.ReactNode }) {
  const [rotate, setRotate] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const portrait = window.matchMedia('(orientation: portrait)');
    const touch = window.matchMedia('(pointer: coarse)');

    const update = () => setRotate(portrait.matches && touch.matches);
    update();

    if (portrait.addEventListener) portrait.addEventListener('change', update);
    else if (portrait.addListener) portrait.addListener(update);
    window.addEventListener('orientationchange', update);
    window.addEventListener('resize', update);

    return () => {
      if (portrait.removeEventListener) portrait.removeEventListener('change', update);
      else if (portrait.removeListener) portrait.removeListener(update);
      window.removeEventListener('orientationchange', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <div className={rotate ? 'force-landscape' : undefined} style={rotate ? undefined : { display: 'contents' }}>
      {children}
    </div>
  );
}
