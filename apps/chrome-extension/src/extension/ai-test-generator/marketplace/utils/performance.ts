/**
 * Performance Utilities
 * Optimizations for marketplace: debouncing, lazy loading, virtualization helpers
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Debounce a value - delays updating until after delay ms of no changes
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce a callback function
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Throttle a callback - ensures it's called at most once per interval
 */
export function useThrottledCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  interval: number
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallRef.current;

      if (timeSinceLastCall >= interval) {
        lastCallRef.current = now;
        callback(...args);
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callback(...args);
        }, interval - timeSinceLastCall);
      }
    },
    [callback, interval]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefCallback<Element>, boolean] {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setRef = useCallback(
    (element: Element | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      if (element) {
        observerRef.current = new IntersectionObserver(([entry]) => {
          setIsIntersecting(entry.isIntersecting);
        }, options);
        observerRef.current.observe(element);
      }
    },
    [options.threshold, options.root, options.rootMargin]
  );

  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  return [setRef, isIntersecting];
}

/**
 * Lazy load component visibility
 */
export function useLazyLoad(
  threshold: number = 0.1
): [React.RefCallback<Element>, boolean] {
  const [hasLoaded, setHasLoaded] = useState(false);
  const [ref, isIntersecting] = useIntersectionObserver({ threshold });

  useEffect(() => {
    if (isIntersecting && !hasLoaded) {
      setHasLoaded(true);
    }
  }, [isIntersecting, hasLoaded]);

  return [ref, hasLoaded];
}

/**
 * Virtualization helper for large lists
 */
export function useVirtualList<T>(
  items: T[],
  itemHeight: number,
  containerHeight: number,
  overscan: number = 3
): {
  virtualItems: { item: T; index: number; style: React.CSSProperties }[];
  totalHeight: number;
  onScroll: (scrollTop: number) => void;
  scrollTop: number;
} {
  const [scrollTop, setScrollTop] = useState(0);

  const { startIndex, endIndex, virtualItems, totalHeight } = useMemo(() => {
    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      items.length - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        item: items[i],
        index: i,
        style: {
          position: 'absolute' as const,
          top: i * itemHeight,
          height: itemHeight,
          left: 0,
          right: 0,
        },
      });
    }

    return { startIndex, endIndex, virtualItems, totalHeight };
  }, [items, itemHeight, containerHeight, overscan, scrollTop]);

  const onScroll = useCallback((newScrollTop: number) => {
    setScrollTop(newScrollTop);
  }, []);

  return { virtualItems, totalHeight, onScroll, scrollTop };
}

/**
 * Memoized expensive computation with dependencies
 */
export function useMemoizedComputation<T, D extends unknown[]>(
  compute: () => T,
  dependencies: D,
  isEqual?: (a: D, b: D) => boolean
): T {
  const prevDepsRef = useRef<D | null>(null);
  const resultRef = useRef<T | null>(null);

  const hasChanged = useMemo(() => {
    if (prevDepsRef.current === null) {
      return true;
    }
    if (isEqual) {
      return !isEqual(prevDepsRef.current, dependencies);
    }
    if (prevDepsRef.current.length !== dependencies.length) {
      return true;
    }
    return prevDepsRef.current.some((dep, i) => dep !== dependencies[i]);
  }, [dependencies, isEqual]);

  if (hasChanged) {
    resultRef.current = compute();
    prevDepsRef.current = dependencies;
  }

  return resultRef.current as T;
}

/**
 * Request idle callback for non-urgent work
 */
export function useIdleCallback(
  callback: () => void,
  options: { timeout?: number } = {}
): () => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(() => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => callbackRef.current(), {
        timeout: options.timeout || 1000,
      });
    } else {
      setTimeout(() => callbackRef.current(), 1);
    }
  }, [options.timeout]);
}

/**
 * Batch state updates
 */
export function useBatchedUpdates<T>(
  initialValue: T,
  delay: number = 100
): [T, (updater: (prev: T) => T) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue);
  const pendingUpdatesRef = useRef<Array<(prev: T) => T>>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queueUpdate = useCallback(
    (updater: (prev: T) => T) => {
      pendingUpdatesRef.current.push(updater);

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          setValue((prev) => {
            let result = prev;
            for (const update of pendingUpdatesRef.current) {
              result = update(result);
            }
            pendingUpdatesRef.current = [];
            return result;
          });
          timeoutRef.current = null;
        }, delay);
      }
    },
    [delay]
  );

  const flushUpdates = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (pendingUpdatesRef.current.length > 0) {
      setValue((prev) => {
        let result = prev;
        for (const update of pendingUpdatesRef.current) {
          result = update(result);
        }
        pendingUpdatesRef.current = [];
        return result;
      });
    }
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, queueUpdate, flushUpdates];
}

/**
 * Prefetch data before it's needed
 */
export function usePrefetch<T>(
  fetchFn: () => Promise<T>,
  options: { enabled?: boolean; delay?: number } = {}
): { data: T | null; isLoading: boolean; prefetch: () => void } {
  const { enabled = true, delay = 500 } = options;
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fetchedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const prefetch = useCallback(async () => {
    if (fetchedRef.current || isLoading) return;

    setIsLoading(true);
    try {
      const result = await fetchFn();
      setData(result);
      fetchedRef.current = true;
    } catch (error) {
      console.error('Prefetch failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn, isLoading]);

  useEffect(() => {
    if (enabled && !fetchedRef.current) {
      timeoutRef.current = setTimeout(prefetch, delay);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, delay, prefetch]);

  return { data, isLoading, prefetch };
}

/**
 * Image lazy loading hook
 */
export function useLazyImage(
  src: string,
  placeholder?: string
): { imageSrc: string; isLoaded: boolean; error: boolean } {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState(placeholder || '');

  useEffect(() => {
    const img = new Image();
    img.src = src;

    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };

    img.onerror = () => {
      setError(true);
    };

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return { imageSrc, isLoaded, error };
}

/**
 * Stable callback reference that doesn't cause re-renders
 */
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback(
    ((...args) => callbackRef.current(...args)) as T,
    []
  );
}
