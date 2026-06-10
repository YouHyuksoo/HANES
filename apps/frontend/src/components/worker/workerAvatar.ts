export function getWorkerDisplayName(name?: string | null) {
  const normalized = name?.trim();
  return normalized || "-";
}

export function getWorkerInitial(name?: string | null) {
  const displayName = getWorkerDisplayName(name);
  return displayName === "-" ? "?" : displayName.charAt(0);
}
