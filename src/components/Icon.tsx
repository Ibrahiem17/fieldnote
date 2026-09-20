// src/components/Icon.tsx
//
// The app's icons, from Lucide (a free, open-source icon set, ISC licence) drawn
// with react-native-svg. One small wrapper so every icon shares the same stroke
// weight and so screens ask for an icon by a plain name instead of importing the
// library directly. Replaces the emoji glyphs the tab bar used to show.

// Each icon comes from its own file: the package's main entry pulls in all ~1,500
// icons, which more than doubled the development bundle.
import ArrowUpRight from "lucide-react-native/icons/arrow-up-right";
import ClipboardCheck from "lucide-react-native/icons/clipboard-check";
import HardHat from "lucide-react-native/icons/hard-hat";
import Plus from "lucide-react-native/icons/plus";
import Settings from "lucide-react-native/icons/settings";

const icons = {
  projects: HardHat,
  inspections: ClipboardCheck,
  settings: Settings,
  arrow: ArrowUpRight,
  plus: Plus,
} as const;

export type IconName = keyof typeof icons;

type Props = {
  name: IconName;
  color: string;
  size?: number;
  strokeWidth?: number;
};

export function Icon({ name, color, size = 22, strokeWidth = 2.25 }: Props) {
  const Glyph = icons[name];
  return <Glyph color={color} size={size} strokeWidth={strokeWidth} />;
}
