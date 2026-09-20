// src/components/BusyButton.tsx
//
// A Button for actions that take a moment (opening the camera, waiting for a
// GPS fix). The moment it's tapped it shows a spinner and a "…ing" label and
// ignores further taps. Without this, the camera took several seconds to open
// in a development build with no sign anything was happening, so a first-time
// user tapped again and again and concluded the button was broken.

import { useState } from "react";

import { Button } from "./Button";

type Props = {
  label: string;
  /** Shown while the action runs, e.g. "Opening camera…". */
  busyLabel: string;
  onPress: () => Promise<void>;
  variant?: "primary" | "secondary" | "danger";
};

export function BusyButton({ label, busyLabel, onPress, variant }: Props) {
  const [busy, setBusy] = useState(false);

  return (
    <Button
      label={busy ? busyLabel : label}
      variant={variant}
      loading={busy}
      onPress={async () => {
        if (busy) return;
        setBusy(true);
        try {
          await onPress();
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}
