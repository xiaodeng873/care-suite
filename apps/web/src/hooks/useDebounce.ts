import { useState, useEffect } from 'react';

/**
 * Delays propagating a value until it hasn't changed for `delay` ms.
 * Use this to prevent expensive computations (filters, searches) from
 * running on every keystroke.
 *
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 200);
 * const filtered = useMemo(() => list.filter(...debouncedSearch...), [list, debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
