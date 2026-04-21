export function normalizeEnvValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";

  const wrappedInDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const wrappedInSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");

  if (wrappedInDoubleQuotes || wrappedInSingleQuotes) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

