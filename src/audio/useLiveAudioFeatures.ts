import { useEffect, useRef } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { useAudioSampleListener, type AudioPlayer } from "expo-audio";

import { FeatureExtractor } from "./FeatureExtractor";
import { silentFeatures, type AudioFeatures } from "./types";

const SIMULATED_BPM = 120;

/**
 * Drives the live in-app preview from real audio when it can, and from a
 * simulated pulse when it can't -- mirroring Kami's own GUI, which "reacts
 * to a simulated 120bpm pulse" before real analysis is ready. Here that
 * fallback also quietly absorbs the current expo-audio rough edge where
 * `useAudioSampleListener` doesn't reliably fire on every device/OS
 * combination: if no real sample callback arrives within `fallbackDelayMs`,
 * Mura keeps animating on the simulated pulse instead of freezing, and
 * seamlessly switches to real samples the moment they start arriving.
 *
 * Returns a Reanimated SharedValue so the Skia canvas's draw loop can read
 * the latest features every frame on the UI thread without going through
 * React state/re-renders (essential for smooth 60fps drawing).
 */
export function useLiveAudioFeatures(
  player: AudioPlayer,
  sampleRate = 44100
): SharedValue<AudioFeatures> {
  const features = useSharedValue<AudioFeatures>(silentFeatures());
  const extractorRef = useRef<FeatureExtractor | null>(null);
  const usingRealSamplesRef = useRef(false);
  const lastRealSampleAtRef = useRef(0);

  if (!extractorRef.current) {
    extractorRef.current = new FeatureExtractor({ sampleRate });
  }

  // Real audio samples, when the platform delivers them.
  useAudioSampleListener(player, (sample) => {
    const extractor = extractorRef.current!;
    const channel = sample.channels[0]?.frames;
    if (!channel || channel.length === 0) return;
    usingRealSamplesRef.current = true;
    lastRealSampleAtRef.current = Date.now();
    const chunk = channel instanceof Float32Array ? channel : Float32Array.from(channel);
    const dt = chunk.length / sampleRate;
    features.value = extractor.push(chunk, dt);
  });

  // Simulated fallback pulse -- runs continuously but is only "visible"
  // (i.e. actually written to the shared value) when we haven't seen a
  // real sample recently, so it never fights with real audio-driven motion.
  useEffect(() => {
    const startedAt = Date.now();
    const beatSec = 60 / SIMULATED_BPM;
    let raf: ReturnType<typeof setInterval>;

    raf = setInterval(() => {
      const staleForMs = Date.now() - lastRealSampleAtRef.current;
      const realIsFresh = usingRealSamplesRef.current && staleForMs < 400;
      if (realIsFresh) return;

      const t = (Date.now() - startedAt) / 1000;
      const phase = (t % beatSec) / beatSec;
      const pulse = Math.pow(1 - phase, 3); // sharp attack, decaying tail
      const wobble = 0.5 + 0.5 * Math.sin(t * 1.7);

      const waveformLen = 128;
      const waveform = new Array(waveformLen)
        .fill(0)
        .map((_, i) => Math.sin(t * 3 + (i / waveformLen) * Math.PI * 4) * (0.15 + pulse * 0.5));
      const spectrumLen = 32;
      const spectrum = new Array(spectrumLen)
        .fill(0)
        .map((_, i) => Math.max(0, (Math.sin(i * 0.7 + t * 2) * 0.5 + 0.5) * (0.3 + pulse * 0.8) * (1 - i / spectrumLen)));

      features.value = {
        level: 0.35 + pulse * 0.5,
        bass: pulse * 0.9,
        mid: 0.25 + wobble * 0.3,
        treble: 0.15 + wobble * 0.2,
        onset: phase < 0.06 ? 1.0 : 0.0,
        isDrop: false,
        waveform,
        spectrum,
        t,
      };
    }, 1000 / 60);

    return () => clearInterval(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return features;
}
