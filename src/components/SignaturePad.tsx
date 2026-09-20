import React from "react";
import { View, Modal, StyleSheet, ActivityIndicator, Alert, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/Button";

// The signature library's own footer (Clear / Save) either didn't render or
// was hidden on a real phone, leaving no way to confirm a signature
// (docs/DESIGN.md D-037). So the library's footer is hidden on purpose and the
// three buttons below are ours, driving the library through its ref API.
export default function SignaturePad({
  visible,
  onSave,
  onCancel,
}: {
  visible: boolean;
  onSave: (base64: string) => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  const padRef = React.useRef<any>(null);
  const [loaded, setLoaded] = React.useState(false);
  const [SignatureView, setSignatureView] = React.useState<any>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const mod = await import("react-native-signature-canvas");
        if (!cancelled) {
          setSignatureView(() => mod.default);
          setLoaded(true);
        }
      } catch (e) {
        console.warn("react-native-signature-canvas not available:", e);
        setLoaded(true); // allow fallback
      }
    }
    if (visible) load();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {!loaded && <ActivityIndicator size="large" />}
        {loaded && SignatureView ? (
          <>
            <View style={styles.pad}>
              <SignatureView
                ref={padRef}
                onOK={(sig: string) => {
                  // sig is a base64 png data URL or raw base64 depending on lib
                  // Normalize: if it starts with data:, strip header
                  const data = sig?.startsWith?.("data:") ? sig.split(",")[1] : sig;
                  onSave(data);
                }}
                onEmpty={() => Alert.alert("No signature", "Please provide a signature or cancel.")}
                descriptionText={"Sign inside the box"}
                webStyle={`.m-signature-pad--footer {display: none; margin: 0px;}`}
              />
            </View>
            <View style={[styles.actions, { paddingBottom: insets.bottom + 12 }]}>
              <View style={styles.action}>
                <Button label="Cancel" variant="secondary" onPress={onCancel} />
              </View>
              <View style={styles.action}>
                <Button label="Clear" variant="secondary" onPress={() => padRef.current?.clearSignature()} />
              </View>
              <View style={styles.action}>
                <Button label="Save" onPress={() => padRef.current?.readSignature()} />
              </View>
            </View>
          </>
        ) : null}
        {loaded && !SignatureView ? (
          // Fallback: show a message — the caller should fallback to placeholder.
          // (`Alert` is react-native's imperative dialog API — `Alert.alert(...)` —
          // not a component, so it can't be rendered as JSX; a plain Text does the job.)
          <View style={{ padding: 16 }}>
            <Text>Signature not available on this platform.</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  pad: { flex: 1 },
  actions: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 12 },
  action: { flex: 1 },
});
