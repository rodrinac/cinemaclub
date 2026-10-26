// "Ledger" palette: soft graphite surfaces, warm off-white text, and gold used
// sparingly for ratings, the active state, and the AI pitch. Text never sits on
// imagery, so every pairing below is a fixed token pair (body text >= 4.5:1).
const Theme = {
  colors: {
    primary: "#12131A",
    primaryDarker: "#0C0D12",
    background: "#12131A",
    surface: "#1A1B24",
    surfaceAlt: "#252734",
    border: "#252734",
    accentLighter: "#BDBAB2",
    accent: "#ECEAE4",
    text: "#ECEAE4",
    textMuted: "#8F8D87",
    gold: "#D9A441",
    goldDarker: "#B5872F",
    onGold: "#12131A",
    warning: "#D9A441",
    danger: "#E5707A",
    overlay: "rgba(12, 13, 18, 0.85)",
    backdrop: "rgba(12, 13, 18, 0.96)",
  },
  fonts: {
    display: "Fraunces_600SemiBold",
    displayItalic: "Fraunces_400Regular_Italic",
    body: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
  },
  // Type scale in px. `label` is set in small caps style (uppercase, tracked).
  type: {
    displayLarge: 34,
    display: 26,
    title: 20,
    body: 17,
    meta: 15,
    caption: 13,
    label: 11,
  },
  layout: {
    // Width at which navigation moves from the bottom tab bar to a side rail.
    wideBreakpoint: 1024,
    compactBreakpoint: 768,
    contentMaxWidth: 1120,
    readingMaxWidth: 680,
    railWidth: 88,
  },
};

export default Theme;
