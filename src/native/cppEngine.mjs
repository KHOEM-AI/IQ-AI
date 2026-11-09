import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const nativePath = fileURLToPath(
  new URL('../../native/cpp/build/Release/iqai_native.node', import.meta.url)
);

let nativeModule = null;

try {
  nativeModule = require(nativePath);
} catch {
  nativeModule = null;
}

export const nativeAvailable =
  typeof nativeModule?.analyzePcm16 === 'function';

export const nativePcm24Available =
  typeof nativeModule?.analyzePcm24 === "function";

export const nativeFloat32Available =
  typeof nativeModule?.analyzeFloat32 === "function";

export function analyzeFloat32(buffer) {
  if (arguments.length !== 1) {
    throw new TypeError("Expected one Float32 Buffer");
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("Input must be a Node.js Buffer");
  }

  if (!nativeFloat32Available) {
    throw new Error("cpp_native_float32_not_built");
  }

  return nativeModule.analyzeFloat32(buffer);
}

export const nativeFloat64Available =
  typeof nativeModule?.analyzeFloat64 === "function";

export function analyzeFloat64(buffer) {
  if (arguments.length !== 1) {
    throw new TypeError("Expected one Float64 Buffer");
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("Input must be a Node.js Buffer");
  }

  if (!nativeFloat64Available) {
    throw new Error("cpp_native_float64_not_built");
  }

  return nativeModule.analyzeFloat64(buffer);
}

export function analyzePcm16(buffer) {
  if (arguments.length !== 1) {
    throw new TypeError("Expected one PCM16 Buffer");
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('Input must be a Node.js Buffer');
  }

  if (!nativeAvailable) {
    throw new Error('cpp_native_module_not_built');
  }

  return nativeModule.analyzePcm16(buffer);
}

export function analyzePcm24(buffer) {
  if (arguments.length !== 1) {
    throw new TypeError("Expected one PCM24 Buffer");
  }
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError("Input must be a Node.js Buffer");
  }

  if (!nativePcm24Available) {
    throw new Error("cpp_native_pcm24_not_built");
  }

  return nativeModule.analyzePcm24(buffer);
}
