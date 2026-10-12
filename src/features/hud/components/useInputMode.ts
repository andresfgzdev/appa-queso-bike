import { useEffect, useState } from "react";

/**
 * Touch vs. desktop is decided by the *input device*, not the screen width: a phone in
 * landscape is wider than many breakpoints but still needs on-screen controls.
 * `?touch` / `?desktop` in the URL force a mode (handy for testing).
 */
export function useIsTouch(): boolean {
  const detect = () => {
    const params = new URLSearchParams(location.search);
    if (params.has("touch")) return true;
    if (params.has("desktop")) return false;
    const coarse = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
    return coarse || (navigator.maxTouchPoints > 0 && !matchMedia("(pointer: fine)").matches);
  };
  const [isTouch, setIsTouch] = useState(detect);

  useEffect(() => {
    const mq = matchMedia("(pointer: coarse)");
    const update = () => setIsTouch(detect());
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return isTouch;
}

/** True on short viewports (phones in landscape) or narrow ones (phones in portrait). */
export function useIsCompact(): boolean {
  const query = "(max-height: 520px), (max-width: 640px)";
  const [compact, setCompact] = useState(() => matchMedia(query).matches);

  useEffect(() => {
    const mq = matchMedia(query);
    const update = () => setCompact(mq.matches);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return compact;
}
