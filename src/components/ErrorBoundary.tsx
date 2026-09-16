// src/components/ErrorBoundary.tsx
//
// Phase 4, Day 4 — the one way React lets you catch an error thrown while
// RENDERING a screen. A normal try/catch only catches errors in code that
// runs imperatively (an event handler, an async function) — it can never
// catch one thrown while React is building the component tree itself. An
// "error boundary" is a special kind of component (it MUST be a class —
// this capability has no hook equivalent as of this React version) that
// reacts to that specific kind of failure and swaps in a fallback screen
// instead of crashing to blank/red.
//
// Wraps the whole app once, in src/app/_layout.tsx, rather than every
// screen individually — one boundary catching everything below it is
// simpler than one per screen, and this app has no case where "half the
// screen still works" is more useful than "show a clear recovery screen."

import { Component, type ReactNode } from "react";
import { View } from "react-native";
import { Text } from "./Text";
import { Button } from "./Button";
import { palettes } from "@/theme/tokens";
import { reportError } from "@/lib/sentry";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  // React calls this automatically the moment a child throws during
  // render. Returning a new state object here is what tells React "throw
  // away what you were about to render, use this fallback instead."
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  // Separate from getDerivedStateFromError on purpose — that one exists
  // to compute new state (must be pure); this one exists to have a SIDE
  // EFFECT (logging) once the error is known. `reportError` (Phase 4,
  // Day 6) sends it to Sentry when a real DSN is configured — this
  // sandbox has none, so today that call is a no-op, same as it's always
  // been; console.error stays regardless, so a crash is never silent
  // even without Sentry.
  componentDidCatch(error: Error, info: { componentStack: string }): void {
    console.error("[ErrorBoundary] caught a render error:", error, info.componentStack);
    reportError(error);
  }

  // Lets the fallback screen's "Try again" button attempt a fresh render
  // of whatever crashed, without restarting the whole app.
  reset = (): void => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const theme = palettes.light;
      return (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            gap: 12,
            backgroundColor: theme.bg,
          }}
        >
          <Text variant="title">Something went wrong</Text>
          <Text muted style={{ textAlign: "center" }}>
            The screen ran into a problem it couldn&apos;t recover from on its
            own. Your data is safe — it&apos;s all still on this device.
          </Text>
          <Button label="Try again" onPress={this.reset} />
        </View>
      );
    }
    return this.props.children;
  }
}
