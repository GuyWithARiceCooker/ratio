import { StatusBar } from "expo-status-bar";
import * as ImageManipulator from "expo-image-manipulator";
import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  type PhotoFile,
} from "react-native-vision-camera";

type Facing = "back" | "front";
type Shot = { uri: string; width: number; height: number; ratio: string };

const INK = "#0e0f0c";
const PAPER = "#f4f0e6";
const BRASS = "#e0a24a";
const MIST = "#9c968a";

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function formatRatio(w: number, h: number): string {
  const width = Math.max(1, Math.round(w));
  const height = Math.max(1, Math.round(h));
  const d = gcd(width, height);
  return `${width / d}∶${height / d}`;
}

function metersForUnit(unit: number): string {
  const t = Math.min(1, Math.max(0, unit));
  const meters = Math.exp(Math.log(0.1) + t * (Math.log(8) - Math.log(0.1)));
  if (meters < 1) return `${Math.max(1, Math.round(meters * 100))} cm`;
  if (meters < 10) return `${(Math.round(meters * 10) / 10).toFixed(1)} m`;
  return `${Math.round(meters)} m`;
}

function coverCrop(srcW: number, srcH: number, viewW: number, viewH: number) {
  const target = viewW / viewH;
  const source = srcW / srcH;
  if (source > target) {
    const width = Math.round(srcH * target);
    return {
      originX: Math.max(0, Math.round((srcW - width) / 2)),
      originY: 0,
      width,
      height: srcH,
    };
  }
  const height = Math.round(srcW / target);
  return {
    originX: 0,
    originY: Math.max(0, Math.round((srcH - height) / 2)),
    width: srcW,
    height,
  };
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppInner />
    </SafeAreaProvider>
  );
}

function AppInner() {
  const insets = useSafeAreaInsets();
  const camera = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const [facing, setFacing] = useState<Facing>("back");
  const device = useCameraDevice(facing);
  const [unit, setUnit] = useState(0.72);
  const [torch, setTorch] = useState(false);
  const [grid, setGrid] = useState(true);
  const [busy, setBusy] = useState(false);
  const [shot, setShot] = useState<Shot | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dims, setDims] = useState(() => Dimensions.get("window"));
  const focusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setDims(window));
    return () => sub.remove();
  }, []);

  const ratio = useMemo(() => formatRatio(dims.width, dims.height), [dims]);
  const focusLabel = useMemo(() => metersForUnit(unit), [unit]);

  const pullFocus = useCallback(
    (next: number) => {
      const cam = camera.current;
      if (!cam || !device?.supportsFocus) return;
      const y = dims.height * (0.18 + (1 - next) * 0.64);
      void cam.focus({ x: dims.width / 2, y }).catch(() => undefined);
    },
    [device?.supportsFocus, dims.height, dims.width],
  );

  const onRail = useCallback(
    (next: number) => {
      const clamped = Math.min(1, Math.max(0, next));
      setUnit(clamped);
      if (focusTimer.current) clearTimeout(focusTimer.current);
      focusTimer.current = setTimeout(() => pullFocus(clamped), 60);
    },
    [pullFocus],
  );

  const shoot = useCallback(async () => {
    if (!camera.current || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const photo: PhotoFile = await camera.current.takePhoto({
        flash: torch && device?.hasFlash ? "on" : "off",
        enableShutterSound: true,
      });
      const src = photo.path.startsWith("file://") ? photo.path : `file://${photo.path}`;
      const crop = coverCrop(photo.width, photo.height, dims.width, dims.height);
      const result = await ImageManipulator.manipulateAsync(src, [{ crop }], {
        compress: 0.92,
        format: ImageManipulator.SaveFormat.JPEG,
      });
      setShot({
        uri: result.uri,
        width: result.width,
        height: result.height,
        ratio: formatRatio(result.width, result.height),
      });
    } catch {
      setNotice("The photo didn't come out. Try again.");
    } finally {
      setBusy(false);
    }
  }, [busy, device?.hasFlash, dims.height, dims.width, torch]);

  const saveShot = useCallback(async () => {
    if (!shot) return;
    const perm = await MediaLibrary.requestPermissionsAsync(true);
    if (!perm.granted) {
      setNotice("Gallery permission is missing; the photo is only visible here.");
      return;
    }
    await MediaLibrary.saveToLibraryAsync(shot.uri);
    setShot(null);
    setNotice("Saved to gallery.");
  }, [shot]);

  if (!hasPermission) {
    return (
      <View style={styles.gate}
        <StatusBar style="light" />
        <Text style={styles.wordmark}>Ratio</Text>
        <Text style={styles.gateCopy}
          Native camera. Photos are taken at your phone's screen ratio; the rail on the right drags focus.
        </Text>
        <Pressable style={styles.primary} onPress={() => void requestPermission()}>
          <Text style={styles.primaryText}>Allow camera</Text>
        </Pressable>
      </View>
    );
  }

  if (!device) {
    return (
      <View style={styles.gate}
        <Text style={styles.wordmark}>Ratio</Text>
        <Text style={styles.gateCopy}>No camera on this device.</Text>
        <Pressable style={styles.primary} onPress={() => setFacing((f) => (f === "back" ? "front" : "back"))}>
          <Text style={styles.primaryText}>Other lens</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}
      <StatusBar style="light" />
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive=!{shot}
        photo
        torch={torch && device.hasTorch ? "on" : "off"}
        enableZoomGesture
      />

      {grid && (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}
          <View style={[styles.vLine, { left: "33.33%" }]} />
          <View style={[styles.vLine, { left: "66.66%" }]} />
          <View style={[styles.hLine, { top: "33.33%" }]} />
          <View style={[styles.hLine, { top: "66.66%" }]} />
        </View>
      )}

      <View pointerEvents="none" style={styles.corners}
        <View style={[styles.corner, styles.cornerTL]} />
        <View style={[styles.corner, styles.cornerTR]} />
        <View style={[styles.corner, styles.cornerBL]} />
        <View style={[styles.corner, styles.cornerBR]} />
      </View>

      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.wordmark}>Ratio</Text>
          <Text style={styles.kicker}>SCREEN</Text>
        </View>
        <View style={styles.headerRight}
          <Text style={styles.ratio}>{ratio}</Text>
          <Text style={styles.pixels}
            {Math.round(dims.width)}×{Math.round(dims.height)}
          </Text>
        </View>
      </View>

      <FocusRail unit={unit} label={focusLabel} top={insets.top + 88} bottom={insets.bottom + 132} onChange={onRail} />

      {notice && (
        <View style={[styles.notice, { top: insets.top + 96 }]}>
          <Text style={styles.noticeText}>{notice}</Text>
        </View>
      )}

      <View style={[styles.dock, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable style={styles.ghost} onPress={() => setGrid((v) => !v)}>
          <Text style={styles.ghostText}>{grid ? "Grid" : "Grid off"}</Text>
        </Pressable>
        <Pressable style={styles.shutter} onPress={() => void shoot()} disabled={busy}
          {busy ? <ActivityIndicator color={INK} /> : <View style={styles.shutterCore} />}
        </Pressable>
        <View style={styles.dockRight}
          {device.hasTorch && (
            <Pressable style={styles.ghost} onPress={() => setTorch((v) => !v)}>
              <Text style={styles.ghostText}>{torch ? "Light off" : "Light"}</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.ghost}
            onPress={() => {
              setTorch(false);
              setFacing((f) => (f === "back" ? "front" : "back"));
            }}
          >
            <Text style={styles.ghostText}>{facing === "back" ? "Front" : "Back"}</Text>
          </Pressable>
        </View>
      </View>

      {shot && (
        <View style={styles.review}
          <Image source={{ uri: shot.uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
          <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
            <Text style={styles.wordmark}>Photo</Text>
            <Text style={styles.ratio}>{shot.ratio}</Text>
          </View>
          <View style={[styles.dock, { paddingBottom: insets.bottom + 18 }]}>
            <Pressable style={styles.ghost} onPress={() => setShot(null)}>
              <Text style={styles.ghostText}>Discard</Text>
            </Pressable>
            <Pressable style={styles.primary} onPress={() => void saveShot()}>
              <Text style={styles.primaryText}>Save</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

function FocusRail(
  unit,
  label,
  top,
  bottom,
  onChange,
}: {
  unit: number;
  label: string;
  top: number;
  bottom: number;
  onChange: (unit: number) => void;
}) {
  const track = useRef<View>(null);
  const fromPageY = (pageY: number) => {
    track.current?.measure((x, y, w, h, px, py) => {
      if (!h) return;
      onChange(1 - Math.min(1, Math.max(0, (pageY - py) / h)));
    });
  };
  return (
    <View style={[styles.railWrap, { top, bottom }]}>
      <Text style={styles.railLabel}>{label}</Text>
      <View
        ref={track}
        style={styles.rail}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(e) => fromPageY(e.nativeEvent.pageY)}
        onResponderMove={(e) => fromPageY(e.nativeEvent.pageY)}
      >
        <View style={styles.railTrack} />
        <View style={[styles.thumb, { top: `${(1 - unit) * 100}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create(
  root: { flex: 1, backgroundColor: INK },
  gate: {
    flex: 1,
    backgroundColor: INK,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 18,
  },
  wordmark: { color: PAPER, fontSize: 28, fontWeight: "600" },
  gateCopy: { color: MIST, fontSize: 16, lineHeight: 22, textAlign: "center" },
  primary: {
    backgroundColor: BRASS,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  primaryText: { color: INK, fontSize: 15, fontWeight: "700" },
  header: {
    position: "absolute",
    left: 18,
    right: 72,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerRight: { alignItems: "flex-end" },
  kicker: { color: MIST, letterSpacing: 2, fontSize: 11, marginTop: 4 },
  ratio: { color: PAPER, fontSize: 28, fontWeight: "600" },
  pixels: { color: MIST, fontSize: 12, marginTop: 2 },
  vLine: { position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(244,240,230,0.2)" },
  hLine: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(244,240,230,0.2)" },
  corners: { ...StyleSheet.absoluteFillObject, margin: 16 },
  corner: { position: "absolute", width: 18, height: 18, borderColor: "rgba(244,240,230,0.7)" },
  cornerTL: { top: 0, left: 0, borderTopWidth: 1, borderLeftWidth: 1 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 1, borderRightWidth: 1 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 1, borderLeftWidth: 1 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 1, borderRightWidth: 1 },
  railWrap: { position: "absolute", right: 10, width: 54, alignItems: "center" },
  railLabel: { color: PAPER, fontSize: 11, marginBottom: 8 },
  rail: { flex: 1, width: 36, alignItems: "center", justifyContent: "center" },
  railTrack: { width: 2, flex: 1, backgroundColor: "rgba(244,240,230,0.35)", borderRadius: 2 },
  thumb: {
    position: "absolute",
    width: 22,
    height: 22,
    marginTop: -11,
    borderRadius: 11,
    backgroundColor: BRASS,
    borderWidth: 2,
    borderColor: INK,
  },
  notice: {
    position: "absolute",
    left: 18,
    right: 78,
    backgroundColor: "rgba(28,30,24,0.92)",
    borderRadius: 10,
    padding: 12,
  },
  noticeText: { color: PAPER, fontSize: 14 },
  dock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
  },
  dockRight: { alignItems: "flex-end", gap: 8, minWidth: 72 },
  ghost: {
    minWidth: 72,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,15,12,0.55)",
    paddingHorizontal: 12,
  },
  ghostText: { color: PAPER, fontSize: 13 },
  shutter: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3,
    borderColor: PAPER,
    alignItems: "center",
    justifyContent: "center",
  },
  shutterCore: { width: 58, height: 58, borderRadius: 29, backgroundColor: PAPER },
  review: { ...StyleSheet.absoluteFillObject, backgroundColor: INK },
});
