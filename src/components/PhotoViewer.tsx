// src/components/PhotoViewer.tsx
//
// Phase 4, Day 4 — a full-screen photo viewer with pinch-to-zoom and
// pan-when-zoomed, opened by tapping a thumbnail in FormRenderer.tsx. This
// is the first place in the app that shows a photo at full size at all —
// every earlier phase only ever listed an attachment's file path as text
// (docs/DESIGN.md, Phase 2/3 notes).

import { Modal, Pressable, useWindowDimensions, Image } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Text } from "./Text";
import { palettes } from "@/theme/tokens";

export function PhotoViewer({
  uri,
  onClose,
}: {
  /** `null` means "closed" — the caller controls visibility by passing a
   * uri or null, the same conditional-rendering pattern this codebase
   * already uses for its other modal (FormRenderer's SignaturePad). */
  uri: string | null;
  onClose: () => void;
}) {
  const { width, height } = useWindowDimensions();

  // Three shared values (Reanimated's term for a piece of state that can
  // be read and written from BOTH the JS thread and the UI thread, unlike
  // ordinary React state) drive the image's transform: how zoomed in it
  // is, and how far it's been dragged in each direction while zoomed.
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  // Remembers the scale/position from BEFORE the current gesture started,
  // so a pinch or pan is additive ("zoom in further from here") rather
  // than resetting to 1x/centre every time a new gesture begins.
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, savedScale.value * e.scale);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // Snap back to 1x (un-zoomed) if the pinch ended close to it, so a
      // photo doesn't get stuck at 1.02x with no obvious way back to
      // exactly "reset."
      if (scale.value < 1.05) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const pan = Gesture.Pan()
    // Panning only makes sense once zoomed in — at 1x the image already
    // fills the same space every time, so there's nothing to drag into
    // view that isn't already visible.
    .onUpdate((e) => {
      if (savedScale.value <= 1) return;
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // Gesture.Simultaneous — both gestures are read at once (pinching AND
  // dragging in the same motion), rather than one cancelling the other.
  const composedGesture = Gesture.Simultaneous(pinch, pan);

  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)" }}
        // Tapping the black backdrop closes the viewer; tapping the image
        // itself (stopPropagation via the inner GestureDetector/Image not
        // being a Pressable) doesn't.
        onPress={onClose}
      >
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[{ flex: 1 }, imageStyle]}>
            <Image
              source={{ uri }}
              style={{ width, height }}
              resizeMode="contain"
            />
          </Animated.View>
        </GestureDetector>
      </Pressable>
      <Pressable
        onPress={onClose}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel="Close photo"
        style={{
          position: "absolute",
          top: 48,
          right: 24,
          backgroundColor: "rgba(255,255,255,0.15)",
          borderRadius: 20,
          width: 40,
          height: 40,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text style={{ color: palettes.dark.text, fontSize: 20 }}>✕</Text>
      </Pressable>
    </Modal>
  );
}
