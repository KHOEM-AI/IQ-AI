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
