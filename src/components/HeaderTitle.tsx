// src/components/HeaderTitle.tsx
//
// The title shown in the top bar of stacked screens ("PROJECT", "NEW INSPECTION"…).
// The navigation library's own title style can't uppercase text on every platform,
// so the header uses this small component instead. Only fixed titles are passed
// through here — never something the person typed.

import { Text } from "./Text";
import { design } from "@/theme/design";

export function HeaderTitle({ children }: { children?: string }) {
  return (
    <Text
      upper
      numberOfLines={1}
      style={{
        fontFamily: design.fonts.headingBold,
        fontSize: 24,
        letterSpacing: 0.6,
        color: design.colors.text,
      }}
    >
      {children}
    </Text>
  );
}
