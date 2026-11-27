import { useEffect, useRef } from 'react';

export function useInfiniteScroll(
  onIntersect: () => void,
  options?: IntersectionObserverInit
): React.RefCallback<Element> {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          onIntersect();
        }
      }, options);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [onIntersect, options]);

  return (node: Element | null) => {
    if (node) {
      observerRef.current?.observe(node);
    } else if (observerRef.current) {
      observerRef.current.disconnect();
    }
  };
}
