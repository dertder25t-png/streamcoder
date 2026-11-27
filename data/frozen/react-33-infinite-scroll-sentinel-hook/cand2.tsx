import { useEffect, useRef } from 'react';

export function useInfiniteScroll(onIntersect: () => void, options?: IntersectionObserverInit): React.RefCallback<Element> {
    const observer = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observer.current = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    onIntersect();
                }
            });
        }, options);

        return () => {
            observer.current?.disconnect();
        };
    }, [options, onIntersect]);

    return (element) => {
        if (element) {
            observer.current?.observe(element);
        }
    };
}
