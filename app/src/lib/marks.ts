/** User rank (`mark`) → colour of the dot next to the name. Unknown ranks fall back to white. */
const MARK_COLORS: Record<number, string> = {
  0: "#ffffff",
  1: "#e108e9",
  2: "#5bb91c",
  3: "#ff9900",
  4: "#444444",
  5: "#008fff",
  6: "#7fc7ff",
  7: "#addc8d",
  8: "#d23c22",
  9: "#1cb992",
  10: "#e5b614",
};

export const markColor = (mark: number): string => MARK_COLORS[mark] ?? MARK_COLORS[0];
