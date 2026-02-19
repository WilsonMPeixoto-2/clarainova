import * as React from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_MEDIA_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const getMobileSnapshot = () => {
  if (typeof window === "undefined") {
    return false;
  }
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
};

const subscribeToMobileChanges = (onStoreChange: () => void) => {
  if (typeof window === "undefined") {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(MOBILE_MEDIA_QUERY);
  const listener = () => onStoreChange();

  mediaQueryList.addEventListener("change", listener);
  return () => mediaQueryList.removeEventListener("change", listener);
};

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileChanges,
    getMobileSnapshot,
    () => false
  );
}
