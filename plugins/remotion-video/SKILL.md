---
name: remotion-video
description: Remotion for programmatic React-based video generation. Covers Composition setup, useCurrentFrame, interpolate, spring animations, Sequence and Series for timeline composition, lazy components, audio tracks with Audio and useAudioData, server-side rendering via @remotion/renderer, and Lambda-based parallel rendering. Use this skill when authoring videos as React components or rendering them in CI/cloud.
---

# Remotion Video

Remotion turns React components into MP4/WebM video. You describe each frame declaratively with JSX; the renderer runs Chromium headlessly to capture frames at a fixed fps and stitches them with ffmpeg. Animations are driven by `useCurrentFrame()` and time helpers like `interpolate` and `spring`.

## Use this skill when

- Generating data-driven videos (annual recaps, ads, charts, social clips) from React
- Defining a `<Composition>` with width, height, fps, and durationInFrames
- Animating with `useCurrentFrame`, `interpolate`, and `spring`
- Composing scenes with `<Sequence>` and `<Series>`
- Adding voiceover or music with `<Audio>` and visualizing waveforms via `useAudioData`
- Rendering with `npx remotion render` or `@remotion/lambda` in the cloud

## Do not use this skill when

- You need real-time video editing UX (use a non-programmatic editor)
- Live streaming or WebRTC pipelines (Remotion renders offline)
- Heavy non-web rendering like 3D scenes that don't fit in a browser canvas budget

## Core concepts

A Remotion project has a `<Root>` registering one or more `<Composition>`s. Each composition is a React component plus metadata: `id`, `width`, `height`, `fps`, `durationInFrames`, and `defaultProps`. Inside that component, `useCurrentFrame()` returns the integer frame number; you derive every visible value from it.

## Quick start

```tsx
// src/Root.tsx
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";

export const Root = () => (
  <Composition
    id="MyVideo"
    component={MyVideo}
    durationInFrames={150}
    fps={30}
    width={1920}
    height={1080}
    defaultProps={{ title: "Hello" }}
  />
);
```

```tsx
// src/MyVideo.tsx
import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig, Sequence, Audio } from "remotion";

export const MyVideo: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" });
  const scale = spring({ frame, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ background: "black", color: "white", justifyContent: "center", alignItems: "center" }}>
      <h1 style={{ fontSize: 120, opacity, transform: `scale(${scale})` }}>{title}</h1>
      <Sequence from={60} durationInFrames={90}>
        <Audio src={require("./voice.mp3")} />
      </Sequence>
    </AbsoluteFill>
  );
};
```

```bash
npx remotion preview              # Studio at localhost:3000
npx remotion render MyVideo out/video.mp4 --props='{"title":"Ship it"}'
```

## Key patterns

### useCurrentFrame and interpolate
`interpolate(frame, [inStart, inEnd], [outStart, outEnd], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })` is the workhorse. Without `clamp` values extend linearly past the range.

### spring
`spring({ frame, fps, from, to, config })` for natural easing. Cheaper than chained interpolations and feels more organic for entrances.

### Sequence and Series
`<Sequence from={120} durationInFrames={60}>` shifts the local `useCurrentFrame()` so children see frame 0 at global frame 120. `<Series>` lines up sequences back-to-back without manual offsets.

### Lazy components
`lazyComponent` on `<Composition>` defers loading code until the composition is selected. Helps when one project ships many heavy compositions.

### Server-side rendering
```ts
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";

const serveUrl = await bundle({ entryPoint: "./src/index.ts" });
const composition = await selectComposition({ serveUrl, id: "MyVideo", inputProps });
await renderMedia({ composition, serveUrl, codec: "h264", outputLocation: "out.mp4", inputProps });
```

### Lambda rendering
`@remotion/lambda` shards a render across hundreds of AWS Lambda invocations and stitches the output, often 10-50x faster than a single machine.

## Common pitfalls

- Using `setTimeout`, `requestAnimationFrame`, or wall-clock time; the renderer is frame-by-frame, only `useCurrentFrame()` is reliable.
- Forgetting `extrapolateRight: "clamp"` and getting opacities greater than 1 or negative values.
- Reading `Date.now()` or `Math.random()` inside the component without `random("seed")` from Remotion; renders become non-deterministic across frames.
- Loading remote assets without `staticFile()` or `delayRender()`; frames capture before assets arrive.
- Mismatched `durationInFrames` and audio length, producing clipped or silent tails.
- Heavy DOM in every frame (thousands of nodes) slows render dramatically; prefer canvas/SVG with memoization.
- Using CSS animations or transitions; they run on real time, not frame time, and won't capture correctly.

## Reference

- Official docs: https://www.remotion.dev/docs/
- Lambda: https://www.remotion.dev/docs/lambda
- Related: [[tauri-desktop]]
