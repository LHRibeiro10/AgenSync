import { useCallback, useRef, useState } from "react";

export function useSubmitLock() {
  const lockRef = useRef(false);
  const [pending, setPending] = useState(false);

  const guard = useCallback(async (fn) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setPending(true);
    try {
      await fn();
    } finally {
      lockRef.current = false;
      setPending(false);
    }
  }, []);

  return [pending, guard];
}
