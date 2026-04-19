import { useCallback, useEffect, useRef, useState } from "react";

export function useAsyncData(fetcher, { immediate = true, initialData = null } = {}) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(Boolean(immediate));
  const [error, setError] = useState("");
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args) => {
      setLoading(true);
      setError("");

      try {
        const response = await fetcher(...args);
        if (!mountedRef.current) return response;
        setData(response);
        return response;
      } catch (err) {
        if (!mountedRef.current) return null;
        setError(err?.message || "Nao foi possivel carregar os dados.");
        return null;
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [fetcher]
  );

  useEffect(() => {
    if (!immediate) return;
    run();
  }, [immediate, run]);

  return {
    data,
    setData,
    loading,
    error,
    setError,
    run
  };
}
