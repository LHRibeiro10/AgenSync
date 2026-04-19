import { createContext, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);

  function showToast(message, type = "success") {
    const id = Date.now();
    setToast({ id, message, type });
    window.setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 2800);
  }

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-3 top-4 z-[60] flex justify-center sm:inset-x-auto sm:right-5 sm:justify-end">
        {toast ? (
          <div
            className={`toast-enter pointer-events-auto rounded-xl border px-4 py-3 text-sm font-semibold shadow-panel ${
              toast.type === "error"
                ? "border-red-200 bg-red-50 text-danger"
                : "border-green-200 bg-white text-success"
            }`}
          >
            {toast.message}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast deve ser usado dentro de ToastProvider.");
  }
  return context;
}
