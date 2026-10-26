import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectWav } from '../src/audio/inspectWav.mjs';

function makeWav(rate, ch, bits, seconds) {
  const dataBytes = rate * ch * (bits / 8) * seconds;
  const b = Buffer.alloc(44 + dataBytes);
  b.write('RIFF', 0, 'ascii'); b.writeUInt32LE(36 + dataBytes, 4); b.write('WAVE', 8, 'ascii');
  b.write('fmt ', 12, 'ascii'); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20);
  b.writeUInt16LE(ch, 22); b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * ch * (bits / 8), 28); b.writeUInt16LE(ch * (bits / 8), 32);
  b.writeUInt16LE(bits, 34); b.write('data', 36, 'ascii'); b.writeUInt32LE(dataBytes, 40);
  return b;
}

test('valid wav', () => {
  const r = inspectWav(makeWav(8000, 1, 16, 1));
  assert.equal(r.ok, true);
  assert.equal(r.sampleRate, 8000);
  assert.equal(r.channels, 1);
  assert.equal(r.durationSec, 1);
});
test('stereo 2 seconds', () => assert.equal(inspectWav(makeWav(16000, 2, 16, 2)).durationSec, 2));
test('not wav', () => assert.equal(inspectWav(Buffer.from('hello world, not audio')).ok, false));
test('too short', () => assert.equal(inspectWav(Buffer.alloc(3)).ok, false));
