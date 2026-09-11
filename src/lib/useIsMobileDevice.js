import { useEffect, useState } from 'react';

export function useIsMobileDevice(breakpoint = 860) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.screen.width <= breakpoint;
  });

  useEffect(() => {
    function check() {
      setIsMobile(window.screen.width <= breakpoint);
    }
    check();
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [breakpoint]);

  return isMobile;
}