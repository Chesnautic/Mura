import { Platform } from 'react-native';
import { registerRootComponent } from 'expo';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately.
//
// On web (which is how the desktop/Electron build runs), @shopify/react-native-skia
// renders via CanvasKit compiled to WebAssembly instead of the native Skia binding
// used on iOS/Android -- and its web module captures `global.CanvasKit` into a
// module-scope constant (`export const Skia = JsiSkApi(global.CanvasKit)`) the
// instant it's first imported. That means it's not enough to just await
// LoadSkiaWeb() before *rendering* -- './App' has to not even be *required* yet
// when LoadSkiaWeb() runs, otherwise react-native-skia (pulled in transitively by
// every waveform engine) evaluates with `global.CanvasKit` still undefined and
// stays permanently broken. Hence the dynamic import below instead of a normal
// top-level `import App from './App'`: on web, nothing under './App' is loaded
// until CanvasKit is ready. Native platforms skip all of this and import/mount
// immediately, exactly as before.
if (Platform.OS === 'web') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { LoadSkiaWeb } = require('@shopify/react-native-skia/lib/module/web');
  // CanvasKit's (emscripten-generated) wasm loader defaults to fetching
  // canvaskit.wasm relative to the *currently executing script's own
  // directory* -- which, in an Expo web export, is
  // /_expo/static/js/web/index-<hash>.js, not the site root. But
  // `expo export --platform web` copies canvaskit.wasm (via the
  // react-native-skia setup script + our public/ folder) to the dist
  // root, served at just "/canvaskit.wasm". Without this override the
  // wasm fetch 404s (served as index.html by SPA fallbacks, which then
  // fails to parse as wasm) and the whole visualizer canvas silently
  // never renders.
  LoadSkiaWeb({ locateFile: (file: string) => `/${file}` })
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('[Mura] CanvasKit (Skia web) loaded, mounting app.');
      return import('./App');
    })
    .then((mod: typeof import('./App')) => registerRootComponent(mod.default))
    .catch((err: unknown) => {
      // eslint-disable-next-line no-console
      console.error('[Mura] CanvasKit failed to load -- the visualizer canvas will not render:', err);
      // Mount anyway: navigation/UI chrome still works even if drawing does not,
      // which is a lot easier to debug from than a blank white screen.
      import('./App').then((mod) => registerRootComponent(mod.default));
    });
} else {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const App = require('./App').default;
  registerRootComponent(App);
}
