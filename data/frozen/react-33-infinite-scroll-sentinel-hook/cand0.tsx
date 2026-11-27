import { useEffect, useRef } from 'react';

export function useInfiniteScroll(
  onIntersect: () => void,
  options?: IntersectionObserverInit
): React.RefCallback<Element> {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          onIntersect();
        }
      });
    }, options);

    observerRef.current = observer;

    return () => {
      observer.disconnect();
    };
  }, [onIntersect, options]);

  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
  }, []);

  return (element) => {
    if (element) {
      observerRef.current?.observe(element);
    }
  };
}
