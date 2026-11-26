import { useCallback, useEffect, useRef, useState } from "react";

export function useInfiniteScroll(onIntersect: () => void, options?: IntersectionObserverInit): React.RefCallback<Element> {
  const [node, setNode] = useState<Element | null>(null);
  const latest = useRef(onIntersect);
  latest.current = onIntersect;
  const root = options?.root ?? null;
  const rootMargin = options?.rootMargin;
  const threshold = Array.isArray(options?.threshold) ? options!.threshold.join(",") : options?.threshold;

  useEffect(() => {
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) latest.current();
      },
      { root, rootMargin, threshold: typeof threshold === "string" ? threshold.split(",").map(Number) : threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, root, rootMargin, threshold]);

  return useCallback((el: Element | null) => setNode(el), []);
}
