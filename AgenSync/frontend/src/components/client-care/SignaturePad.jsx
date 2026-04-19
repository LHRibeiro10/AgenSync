import { useEffect, useRef, useState } from "react";
import Button from "../Button.jsx";

export default function SignaturePad({ existingImage, onSave }) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  function getContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const context = canvas.getContext("2d");
    context.lineWidth = 3;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
    return context;
  }

  function resetCanvas() {
    const canvas = canvasRef.current;
    const context = getContext();
    if (!canvas || !context) return;
    drawingRef.current = false;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
  }

  useEffect(() => {
    resetCanvas();
  }, []);

  function pointerPosition(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDrawing(event) {
    event.preventDefault();
    const context = getContext();
    if (!context) return;
    const point = pointerPosition(event);
    drawingRef.current = true;
    setHasInk(true);
    context.beginPath();
    context.moveTo(point.x, point.y);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function draw(event) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const context = getContext();
    if (!context) return;
    const point = pointerPosition(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing(event) {
    drawingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasInk) return;
    onSave(canvas.toDataURL("image/png"));
    drawingRef.current = false;
    setHasInk(false);
  }

  return (
    <div className="space-y-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
      {existingImage ? (
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-muted">Assinatura salva</p>
          <img
            src={existingImage}
            alt="Assinatura salva"
            className="h-24 w-full rounded-xl border border-[#E2E8F0] bg-white object-contain"
          />
        </div>
      ) : null}
      <canvas
        ref={canvasRef}
        width="720"
        height="220"
        className="h-44 w-full rounded-xl border border-[#CBD5E1] bg-white"
        style={{ touchAction: "none" }}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={stopDrawing}
        onPointerCancel={stopDrawing}
        aria-label="Área para assinatura digital"
      />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={resetCanvas}>
          Limpar assinatura
        </Button>
        <Button onClick={saveSignature} disabled={!hasInk}>
          Salvar assinatura
        </Button>
      </div>
    </div>
  );
}
