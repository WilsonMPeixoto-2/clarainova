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
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          setScrollPosition({
            scrollY: currentScrollY,
            isScrolled: currentScrollY > threshold,
          });
          ticking = false;
        });
        ticking = true;
      }
    };

    // Set initial state
    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  return scrollPosition;
};
