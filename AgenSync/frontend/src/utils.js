export const statusOptions = [
  { value: "agendado", label: "Agendado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
  { value: "nao_compareceu", label: "Não compareceu" }
];

export function todayInputValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function monthStartInputValue() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${month}-01`;
}

export function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export function statusLabel(value) {
  return statusOptions.find((option) => option.value === value)?.label || value;
}

export function addMinutesToTime(time, minutes) {
  if (!time || !minutes) return "";
  const [hours, mins] = time.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return "";
  const date = new Date(2000, 0, 1, hours, mins);
  date.setMinutes(date.getMinutes() + Number(minutes));
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
