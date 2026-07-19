import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G, Path, Rect } from "react-native-svg";

// How long the brand mark holds before fading, even if the app hydrates instantly. Keeps the
// splash from flashing by too fast to read.
const MIN_DURATION = 1200;
const FADE_MS = 360;
const SPIN_MS = 3500; // one graceful 360° revolution of the progress ring

const useNative = Platform.OS !== "web";

// Sampled straight from the app-icon artwork so the recreated mark matches it exactly.
const CHARCOAL = "#151515"; // the deep field inside the old square icon — now the whole screen
const RING_AMBER = "#A47F55";
const RING_JADE = "#73C489";
const CUP = "#C9A46B";
const TITLE = "#F7F3EA"; // high-contrast off-white
const SUBTITLE = "#B9976A"; // mid-tone amber to balance the stack

// Ring geometry. Two 168° arcs leave a small gap at 12 and 6 o'clock; the amber sits on the
// left, jade on the right, and the whole two-tone ring spins as one group.
const RING_SIZE = 220;
const RING_R = 92;
const RING_STROKE = 11;
const CIRC = 2 * Math.PI * RING_R;
const ARC = `${(CIRC * 168) / 360} ${CIRC}`;

/**
 * First-launch brand splash: the milk-tea cup mark on a single unbroken charcoal field, with a
 * two-tone progress ring spinning gracefully around the static cup and the bilingual wordmark
 * stacked beneath. Sits on top of everything as an overlay and dismisses once the store has
 * hydrated AND the minimum hold has passed, so the user never sees a half-loaded frame.
 */
export function SplashOverlay({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const overlay = useRef(new Animated.Value(1)).current; // whole-screen opacity
  const enter = useRef(new Animated.Value(0)).current; // mark fade + rise on entrance
  const spin = useRef(new Animated.Value(0)).current; // ring rotation loop
  const [minElapsed, setMinElapsed] = useState(false);

  // Entrance, the minimum-hold timer, and the infinite ring spin.
  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 460,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: useNative,
    }).start();

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: SPIN_MS,
        easing: Easing.linear,
        useNativeDriver: useNative,
      }),
    );
    loop.start();

    const id = setTimeout(() => setMinElapsed(true), MIN_DURATION);
    return () => {
      loop.stop();
      clearTimeout(id);
    };
  }, [enter, spin]);

  // Fade the whole overlay out once the app is ready and we have shown the brand long enough.
  useEffect(() => {
    if (!ready || !minElapsed) return;
    Animated.timing(overlay, {
      toValue: 0,
      duration: FADE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: useNative,
    }).start(({ finished }) => {
      if (finished) onDone();
    });
  }, [ready, minElapsed, overlay, onDone]);

  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const rise = enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] });
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={[styles.fill, { opacity: overlay }]}>
      <Animated.View
        style={{ opacity: enter, transform: [{ scale }, { translateY: rise }], alignItems: "center" }}
      >
        <View style={{ width: RING_SIZE, height: RING_SIZE }}>
          {/* Spinning layer: only the two-tone ring rotates. */}
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate }] }]}>
            <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <G rotation={96} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  stroke={RING_AMBER}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={ARC}
                  fill="none"
                />
              </G>
              <G rotation={276} origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}>
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_R}
                  stroke={RING_JADE}
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={ARC}
                  fill="none"
                />
              </G>
            </Svg>
          </Animated.View>

          {/* Static layer: the milk-tea cup sits still at the exact centre. */}
          <View style={StyleSheet.absoluteFill}>
            <Svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <G
                stroke={CUP}
                strokeWidth={4.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              >
                <Rect x={78} y={75} width={64} height={14} rx={7} />
                <Path d="M82 89 L82 115 Q82 127 96 127 L124 127 Q138 127 138 115 L138 89" />
                <Path d="M138 96 Q155 96 155 106 Q155 116 138 116" />
                <Path d="M66 132 C 80 149 140 149 154 132" />
                <Path d="M78 132 C 92 140 128 140 142 132" />
              </G>
            </Svg>
          </View>
        </View>

        <View className="mt-6 items-center">
          <Text className="text-2xl font-bold" style={{ color: TITLE }}>
            少甜少底
          </Text>
          <Text
            className="mt-2 text-xs font-medium uppercase"
            style={{ color: SUBTITLE, letterSpacing: 3 }}
          >
            SIU TIM SIU DAI
          </Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: CHARCOAL,
  },
});
