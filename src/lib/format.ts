/**
 * Formata data ISO (YYYY-MM-DD) ou Date para dd/mm/aa.
 */
export function formatDateBR(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string"
    ? new Date(value.length === 10 ? value + "T00:00:00" : value)
    : value;
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const aa = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${aa}`;
}
