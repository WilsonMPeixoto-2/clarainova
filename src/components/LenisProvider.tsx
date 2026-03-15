import { type ReactNode, useEffect, useState } from "react";
import { ReactLenis } from "lenis/react";

interface LenisProviderProps {
  children: ReactNode;
}

const MOBILE_SCROLL_QUERY = "(max-width: 899px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const getQueryMatch = (query: string) => {
  if (typeof window === "undefined" || !window.matchMedia) {
    return false;
  }

  return window.matchMedia(query).matches;
};

export function LenisProvider({ children }: LenisProviderProps) {
  const [reducedMotion, setReducedMotion] = useState(() =>
    getQueryMatch(REDUCED_MOTION_QUERY),
  );
  const [mobileViewport, setMobileViewport] = useState(() =>
    getQueryMatch(MOBILE_SCROLL_QUERY),
  );

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }

    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_QUERY);
    const mobileQuery = window.matchMedia(MOBILE_SCROLL_QUERY);

    const updateReducedMotion = () => setReducedMotion(reducedMotionQuery.matches);
    const updateViewport = () => setMobileViewport(mobileQuery.matches);

    updateReducedMotion();
    updateViewport();

    if (reducedMotionQuery.addEventListener && mobileQuery.addEventListener) {
      reducedMotionQuery.addEventListener("change", updateReducedMotion);
      mobileQuery.addEventListener("change", updateViewport);
      return () => {
        reducedMotionQuery.removeEventListener("change", updateReducedMotion);
        mobileQuery.removeEventListener("change", updateViewport);
      };
    }

    reducedMotionQuery.addListener(updateReducedMotion);
    mobileQuery.addListener(updateViewport);
    return () => {
      reducedMotionQuery.removeListener(updateReducedMotion);
      mobileQuery.removeListener(updateViewport);
    };
  }, []);

  if (reducedMotion || mobileViewport) {
    return <>{children}</>;
  }

  return (
    <ReactLenis
      root
      options={{
        duration: 1.05,
        lerp: 0.1,
        wheelMultiplier: 1,
        smoothWheel: true,
      }}
    >
      {children}
    </ReactLenis>
  );
}
