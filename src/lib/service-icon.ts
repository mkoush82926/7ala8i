// Maps a service name to a Material Symbols icon name via simple keyword
// matching. Services have no photo/icon column in the schema, so this keeps
// the UI from resorting to a handful of generic stock photos repeated across
// every service card — an icon per service reads as intentional design
// instead of placeholder filler.
export function getServiceIcon(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("beard") || n.includes("shave")) return "face";
  if (n.includes("color") || n.includes("dye")) return "palette";
  if (n.includes("spa") || n.includes("facial")) return "spa";
  if (n.includes("keratin") || n.includes("treatment")) return "auto_awesome";
  if (n.includes("kid") || n.includes("child")) return "child_care";
  return "content_cut";
}
