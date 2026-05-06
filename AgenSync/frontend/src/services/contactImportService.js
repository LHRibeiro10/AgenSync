const CONTACT_PICKER_FIELDS = ["name", "tel"];

export function supportsContactPicker() {
  return Boolean(
    typeof navigator !== "undefined" &&
      navigator.contacts &&
      typeof navigator.contacts.select === "function"
  );
}

export function normalizeContactPhone(value = "") {
  const raw = String(value || "").trim();
  const hasLeadingPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return hasLeadingPlus ? `+${digits}` : digits;
}

export async function importSingleContact() {
  if (!supportsContactPicker()) {
    return { contact: null, reason: "unsupported" };
  }

  try {
    const contacts = await navigator.contacts.select(CONTACT_PICKER_FIELDS, { multiple: false });
    const selected = Array.isArray(contacts) ? contacts[0] : null;
    if (!selected) return { contact: null, reason: "cancelled" };

    const name = Array.isArray(selected.name) ? selected.name[0] : selected.name;
    const phone = Array.isArray(selected.tel) ? selected.tel[0] : selected.tel;

    return {
      contact: {
        name: String(name || "").trim(),
        phone: normalizeContactPhone(phone)
      },
      reason: ""
    };
  } catch (error) {
    if (error?.name === "AbortError" || error?.name === "NotAllowedError") {
      return { contact: null, reason: "cancelled" };
    }

    return { contact: null, reason: "error" };
  }
}
