import { useEffect, useState } from 'react';

export function useIsMobileDevice(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(`(max-width: ${breakpoint}px)`).matches;
  });

  useEffect(() => {
    const query = window.matchMedia(`(max-width: ${breakpoint}px)`);
    function check() { setIsMobile(query.matches); }
    check();
    query.addEventListener('change', check);
    return () => {
      query.removeEventListener('change', check);
    };
  }, [breakpoint]);

  return isMobile;
}
