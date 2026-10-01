export const CLUB_TIMEZONE = "America/Vancouver";
export function clubMonth(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(date);
  return `${parts.find((p) => p.type === "year").value}-${parts.find((p) => p.type === "month").value}`;
}
const monthIndex = (value) => {
  const [year, month] = value.split("-").map(Number);
  return year * 12 + month - 1;
};
export function addMonths(month, offset) {
  const index = monthIndex(month) + offset;
  return `${Math.floor(index / 12)}-${String((((index % 12) + 12) % 12) + 1).padStart(2, "0")}`;
}
export function rotationOrder(rotation, month) {
  const ids = rotation?.memberIds || [];
  if (!ids.length) return [];
  const offset =
    (((monthIndex(month) - monthIndex(rotation.anchorMonth)) % ids.length) +
      ids.length) %
    ids.length;
  return [...ids.slice(offset), ...ids.slice(0, offset)];
}
export function projectRotation(rotation, month, selections) {
  return rotationOrder(rotation, month).map((chooserId, i) => {
    const when = addMonths(month, i);
    const selected =
      selections.find((s) => s.month === when && s.kind === "history") ||
      selections.find((s) => s.month === when);
    return {
      month: when,
      chooserId,
      bookId: null,
      kind: "upcoming",
      ...selected,
      persisted: !!selected,
      rotationChooserId: chooserId,
    };
  });
}
