import { useState } from "react";
import Button from "./Button.jsx";

export default function ConfirmDialog({
  open,
  title = "Confirmar ação",
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  onConfirm,
  onCancel
}) {
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  async function handleConfirm() {
    if (confirming) return;
    setConfirming(true);
    try {
      await onConfirm?.();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="agensync-overlay z-50 flex items-end bg-slate-950/45 p-3 sm:items-center sm:justify-center">
      <div className="w-full rounded-xl border border-line bg-panel p-5 shadow-panel sm:max-w-md">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button variant="secondary" disabled={confirming} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={confirming}
            loadingLabel={confirmLabel === "Excluir" ? "Excluindo..." : "Confirmando..."}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
