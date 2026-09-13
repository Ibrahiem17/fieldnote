// src/auth/LoginScreen.tsx
//
// Shown by src/app/_layout.tsx whenever there's no session — before any of
// the app's real screens, including preview mode. Plain email/password
// (plan Section 3.1.3); no password-reset flow yet — Phase 3's scope is the
// sync engine, not a full account-management surface.

import { useState } from "react";
import { View } from "react-native";

import { Screen, Text, Input, Button } from "@/components";
import { useTheme } from "@/theme/ThemeProvider";
import { useAuth } from "./AuthProvider";

export default function LoginScreen() {
  const theme = useTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setInfo(null);

    if (!email.trim() || !password) {
      setError("Email and password are both required.");
      return;
    }

    setSubmitting(true);
    const result = mode === "sign-in" ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === "sign-up") {
      // signUp() can succeed without a session yet, if the Supabase project
      // requires email confirmation (its default) — see AuthProvider's
      // signUp() comment. Either way there's nothing more to do here:
      // AuthProvider's onAuthStateChange listener picks up a real session
      // automatically the moment one exists.
      setInfo("Account created. If email confirmation is required, check your inbox, then sign in.");
      setMode("sign-in");
    }
  };

  return (
    <Screen>
      <View style={{ gap: theme.spacing.md, justifyContent: "center", flex: 1 }}>
        <Text variant="title">{mode === "sign-in" ? "Sign in" : "Create account"}</Text>
        <Text variant="caption" muted>
          Fieldnote syncs your inspections to your own account — sign in to enable that. The app
          still works fully offline either way.
        </Text>

        <Input
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
        />
        <Input
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        {error ? (
          <Text variant="caption" style={{ color: theme.colors.danger }}>
            {error}
          </Text>
        ) : null}
        {info ? (
          <Text variant="caption" style={{ color: theme.colors.success }}>
            {info}
          </Text>
        ) : null}

        <Button
          label={mode === "sign-in" ? "Sign in" : "Create account"}
          onPress={handleSubmit}
          loading={submitting}
        />
        <Button
          label={mode === "sign-in" ? "Need an account? Create one" : "Have an account? Sign in"}
          variant="secondary"
          onPress={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
            setInfo(null);
          }}
        />
      </View>
    </Screen>
  );
}
