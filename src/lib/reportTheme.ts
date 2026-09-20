// src/lib/reportTheme.ts
//
// A FROZEN copy of the app's original theme values, used only by the PDF report
// (src/lib/reportHtml.ts). The report used to read the app's live palette, so
// restyling the app would have silently restyled the PDF. Per the design
// decision "keep the PDF exactly as it is" (design/DESIGN.md §0), the report now
// has its own palette that the app's theme can never change.
//
// If the report should ever be restyled, do it here, on purpose.

export const reportPalette = {
  bg: "#FFFFFF",
  surface: "#F9FAFB",
  text: "#111827",
  textMuted: "#6B7280",
  primary: "#2563EB",
  primaryText: "#FFFFFF",
  border: "#E5E7EB",
  danger: "#DC2626",
  success: "#16A34A",
  warning: "#D97706",
} as const;

export const reportFontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 28,
} as const;

export const reportFontWeight = {
  regular: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;
