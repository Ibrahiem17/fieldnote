import React from "react";
import { View, Modal, StyleSheet, ActivityIndicator, Alert } from "react-native";

export default function SignaturePad({ visible, onSave, onCancel }: { visible: boolean; onSave: (base64: string) => void; onCancel: () => void }) {
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
      <View style={styles.container}>
        {!loaded && <ActivityIndicator size="large" />}
        {loaded && SignatureView ? (
          <SignatureView
            onOK={(sig) => {
              // sig is a base64 png data URL or raw base64 depending on lib
              // Normalize: if it starts with data:, strip header
              const data = sig?.startsWith?.("data:") ? sig.split(",")[1] : sig;
              onSave(data);
            }}
            onEmpty={() => Alert.alert("No signature", "Please provide a signature or cancel.")}
            onCancel={onCancel}
            descriptionText={"Sign inside the box"}
            clearText={"Clear"}
            confirmText={"Save"}
            webStyle={`.m-signature-pad--footer {display: none; margin: 0px;}`}
            />
        ) : null}
        {loaded && !SignatureView ? (
          // Fallback: show a message — the caller should fallback to placeholder
          <View style={{ padding: 16 }}>
            <Alert title="Signature not available" />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", justifyContent: "center", alignItems: "center" },
});
