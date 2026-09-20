// src/components/Toast.tsx
//
// A short confirmation that appears at the bottom of the screen and fades away
// ("Photo added", "Saved"). Actions that used to finish silently — so a person
// couldn't tell whether anything had happened — now say so.
//
// Usage: wrap the app in <ToastProvider> once (src/app/_layout.tsx), then in any
// component: `const toast = useToast(); toast.show("Photo added");`
// Styling comes only from theme tokens, so a redesign restyles it for free.

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";

import { useTheme } from "@/theme/ThemeProvider";
import { Text } from "./Text";

type ToastKind = "success" | "error" | "info";
type ToastState = { id: number; message: string; kind: ToastKind };

const ToastContext = createContext<{ show: (message: string, kind?: ToastKind) => void }>({
  show: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((message: string, kind: ToastKind = "success") => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, kind });
    timer.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  const background =
    toast?.kind === "error"
      ? theme.colors.danger
      : toast?.kind === "info"
        ? theme.colors.text
        : theme.colors.success;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: theme.spacing.md,
          right: theme.spacing.md,
          bottom: theme.spacing.xl + theme.spacing.md,
          alignItems: "center",
        }}
      >
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={FadeInDown}
            exiting={FadeOutDown}
            accessibilityLiveRegion="polite"
            style={{
              backgroundColor: background,
              paddingHorizontal: theme.spacing.md,
              paddingVertical: theme.spacing.sm,
              borderRadius: theme.radius.lg,
              maxWidth: "100%",
            }}
          >
            <Text style={{ color: theme.colors.primaryText }}>{toast.message}</Text>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}
