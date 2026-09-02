'use client';

import { useEffect, useState } from 'react';

export function useMediaQuery(query: string): boolean {
  // Initialized to the server-safe fallback (false) unconditionally — reading
  // window.matchMedia() inside the useState initializer would run on both
  // server and client, and for any user whose real match differs from
  // `false` the client's first render would diverge from the
  // server-rendered HTML, producing a hydration mismatch. The real value is
  // applied client-only, post-mount, by the effect below.
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const listener = (event: MediaQueryListEvent) => setMatches(event.matches);
    mql.addEventListener('change', listener);
    return () => mql.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
