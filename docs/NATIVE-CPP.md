# IQ-AI Native C++ Engine

## Technology
- C++17
- Node-API (N-API version 8)
- CMake
- Node.js ES Modules

## Native PCM16 Analyzer

The native engine analyzes signed 16-bit little-endian PCM audio.

It returns:
- sampleCount
- peak (normalized amplitude)
- rms (normalized amplitude)
- peakDbfs
- rmsDbfs

Silence is represented as -160 dBFS.

## Production Audio Integration

The native analyzer is connected to:

`POST /api/v1/audio/inspect`

The existing JavaScript WAV inspector remains responsible for the original WAV metadata and validation response.

Supported native analysis:
- PCM format: 1
- 16 bits per sample
- Valid channel count and block alignment

The response retains the existing `data` object and adds:
- `analysis.available`
- `analysis.engine` (`cpp` or `javascript`)
- `analysis.sampleCount`
- `analysis.peak`
- `analysis.rms`
- `analysis.peakDbfs`
- `analysis.rmsDbfs`

Unsupported WAV formats return `analysis.available: false`.

## JavaScript Fallback

If the native module is unavailable, PCM16 analysis uses the JavaScript implementation.

The application can therefore run without a prebuilt native binary.

## Build

```bash
npm run build:native
```

## Native and Integration Tests

```bash
npm run test:native
```

This builds the native module and runs native unit tests and audio integration tests.

## Full Project Tests

```bash
npm test
```

## JavaScript Usage

```js
import { nativeAvailable, analyzePcm16 } from "../src/native/cppEngine.mjs";

if (nativeAvailable) {
  const result = analyzePcm16(pcmBuffer);
}
```

## Safety

- The native API accepts Node.js Buffers only.
- Empty and incomplete PCM16 buffers are rejected.
- PCM samples are decoded explicitly as little-endian.
- WAV parsing remains in JavaScript.
- Only supported PCM16 payloads are sent to the native analyzer.
- No shell command or external process is used by the native module.
- Native build artifacts are excluded from Git.

## Integration Status

The C++ PCM16 analyzer is integrated into the production audio inspection route with a JavaScript fallback.
