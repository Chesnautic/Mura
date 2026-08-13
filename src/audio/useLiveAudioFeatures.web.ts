import { useEffect, useRef } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import type { AudioPlayer } from "expo-audio";

import { FeatureExtractor } from "./FeatureExtractor";
import { silentFeatures, type AudioFeatures } from "./types";

/**
 * Web/desktop counterpart to useLiveAudioFeatures.ts, picked automatically
 * by Metro's platform-suffix resolution when bundling for web (the same
 * mechanism ffmpegRunner.web.ts already relies on) -- same signature, zero
 * changes needed at the HomeScreen.tsx call site.
 *
 * This file exists because expo-audio's web player (AudioModule.web.ts)
 * never delivers real sample data: `useAudioSampleListener` on web
 * subscribes to an `AUDIO_SAMPLE_UPDATE` event the web player class never
 * emits, `isAudioSamplingSupported` is hardcoded `false`, and
 * `setAudioSamplingEnabled` is a documented no-op ("Not supported on web").
 * Left as the native hook, every visual on desktop would silently run
 * forever on the native hook's simulated 120bpm fallback pulse -- which
 * matches exactly what got reported from the packaged desktop build: the
 * preview "doing its own automatic animation" regardless of the loaded
 * song, "Confetti Pop" never firing (the simulated pulse hardcodes
 * `isDrop: false`), and "Chrome Tunnel" bouncing to a beat that isn't the
 * track's own.
 *
 * The fix drives real analysis through the Web Audio API: grab the actual
 * <audio> element expo-audio's web player wraps internally, route it
 * through a MediaElementAudioSourceNode -> AnalyserNode (kept connected
 * through to the real output so picking a song still makes sound), and feed
 * each frame's raw time-domain samples into the exact same
 * `FeatureExtractor` class native playback and offline export both use --
 * so desktop, mobile, and export all agree on what a given waveform reacts
 * to.
 */
export function useLiveAudioFeatures(
  player: AudioPlayer,
  sampleRate = 44100
): SharedValue<AudioFeatures> {
  const features = useSharedValue<AudioFeatures>(silentFeatures());
  const extractorRef = useRef<FeatureExtractor | null>(null);
  if (!extractorRef.current) {
    extractorRef.current = new FeatureExtractor({ sampleRate });
  }

  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const wiredMediaRef = useRef<HTMLMediaElement | null>(null);
  const timeBufRef = useRef<Float32Array | null>(null);
  const lastTickRef = useRef<number | null>(null);

  useEffect(() => {
    let raf: ReturnType<typeof requestAnimationFrame>;
    let cancelled = false;

    // expo-audio's web AudioPlayerWeb keeps its real <audio> element as a
    // private class field with no public accessor -- TS-private only, not
    // runtime-private, so this is the only way to reach it. `player.replace()`
    // (called whenever a new song is picked) swaps in a brand-new <audio>
    // element every time, so comparing identity here is what detects a song
    // change and triggers rewiring the Web Audio graph onto the new element.
    const getMediaElement = (): HTMLMediaElement | undefined => (player as any)?.media;

    const ensureWired = () => {
      const media = getMediaElement();
      if (!media || media === wiredMediaRef.current) return;

      if (!audioCtxRef.current) {
        const Ctx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtxRef.current = new Ctx();
      }
      const audioCtx = audioCtxRef.current;

      try {
        // A given <audio> element can only ever be wrapped by one
        // MediaElementAudioSourceNode for its whole lifetime. Since
        // player.replace() always creates a fresh element (rather than
        // reusing the old one), this naturally gets a new node per song
        // instead of ever re-wrapping the same element.
        const source = audioCtx.createMediaElementSource(media);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyser.connect(audioCtx.destination);

        sourceRef.current?.disconnect();
        analyserRef.current?.disconnect();
        sourceRef.current = source;
        analyserRef.current = analyser;
        wiredMediaRef.current = media;
        timeBufRef.current = new Float32Array(analyser.fftSize);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[Mura] Web Audio analysis wiring failed:", err);
      }
    };

    const tick = () => {
      if (cancelled) return;
      ensureWired();

      const audioCtx = audioCtxRef.current;
      const analyser = analyserRef.current;
      const buf = timeBufRef.current;

      // Chrome/Electron suspend a freshly-created AudioContext until a user
      // gesture; retrying resume() every frame picks it back up the moment
      // one happens (e.g. clicking Play) without needing to plumb a gesture
      // callback all the way down from the transport controls.
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }

      const now = Date.now();
      const dt = lastTickRef.current ? Math.min(0.1, (now - lastTickRef.current) / 1000) : 1 / 60;
      lastTickRef.current = now;

      if (analyser && buf) {
        // AnalyserNode.getFloatTimeDomainData's DOM typing and
        // FeatureExtractor.push's plain `Float32Array` parameter resolve to
        // slightly different generic ArrayBuffer type params under TS
        // 5.7+'s typed-array generics; both are real Float32Arrays backed
        // by a real ArrayBuffer at runtime, so this `any` cast is just
        // satisfying the type checker, not changing behavior.
        (analyser.getFloatTimeDomainData as any)(buf);
        features.value = extractorRef.current!.push(buf, dt);
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player]);

  return features;
}
