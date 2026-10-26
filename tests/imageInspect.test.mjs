import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectImage } from '../src/image/inspectImage.mjs';

test('png', () => {
  const b = Buffer.alloc(32);
  b.writeUInt32BE(0x89504e47, 0); b.writeUInt32BE(0x0d0a1a0a, 4);
  b.writeUInt32BE(640, 16); b.writeUInt32BE(480, 20);
  const r = inspectImage(b);
  assert.equal(r.format, 'png'); assert.equal(r.width, 640); assert.equal(r.height, 480);
});
test('gif', () => {
  const b = Buffer.alloc(16);
  b.write('GIF89a', 0, 'ascii'); b.writeUInt16LE(320, 6); b.writeUInt16LE(200, 8);
  const r = inspectImage(b);
  assert.equal(r.format, 'gif'); assert.equal(r.width, 320); assert.equal(r.height, 200);
});
test('jpeg', () => {
  const b = Buffer.alloc(30);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; b[3] = 0xc0; b.writeUInt16BE(17, 4);
  b[6] = 8; b.writeUInt16BE(300, 7); b.writeUInt16BE(400, 9);
  const r = inspectImage(b);
  assert.equal(r.format, 'jpeg'); assert.equal(r.width, 400); assert.equal(r.height, 300);
});
test('webp VP8X', () => {
  const b = Buffer.alloc(40);
  b.write('RIFF', 0, 'ascii'); b.write('WEBP', 8, 'ascii'); b.write('VP8X', 12, 'ascii');
  b.writeUIntLE(799, 24, 3); b.writeUIntLE(599, 27, 3);
  const r = inspectImage(b);
  assert.equal(r.format, 'webp'); assert.equal(r.width, 800); assert.equal(r.height, 600);
});
test('not image', () => assert.equal(inspectImage(Buffer.from('hello world, not an image')).ok, false));
test('too short', () => assert.equal(inspectImage(Buffer.alloc(3)).ok, false));
