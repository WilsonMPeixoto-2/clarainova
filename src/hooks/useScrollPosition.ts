import { useState, useEffect } from 'react';

interface ScrollPosition {
  scrollY: number;
  isScrolled: boolean;
}

export const useScrollPosition = (threshold: number = 50): ScrollPosition => {
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>({
    scrollY: 0,
    isScrolled: false,
  });

  useEffect(() => {
    let rafId: number | null = null;

    const handleScroll = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          setScrollPosition({
            scrollY: currentScrollY,
            isScrolled: currentScrollY > threshold,
          });
          rafId = null;
        });
      }
    };

    // Set initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [threshold]);

  return scrollPosition;
};
