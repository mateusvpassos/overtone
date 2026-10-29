const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { writeAudio } = require('./exporter');

// 0,1 s de senoide em 440 Hz, estéreo
const rate = 44100;
const left = Float32Array.from({ length: rate / 10 }, (_, i) => Math.sin(2 * Math.PI * 440 * i / rate));
const right = left.map(x => -x);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'overtone-'));

test('WAV 16-bit estéreo com cabeçalho correto', () => {
  const f = path.join(tmp, 'a.wav');
  const bytes = writeAudio(f, left, right, rate);
  const b = fs.readFileSync(f);
  assert.equal(bytes, b.length);
  assert.equal(b.toString('ascii', 0, 4), 'RIFF');
  assert.equal(b.toString('ascii', 8, 12), 'WAVE');
  assert.equal(b.readUInt16LE(22), 2);
  assert.equal(b.readUInt32LE(24), rate);
  assert.equal(b.readUInt32LE(40), left.length * 4);
  assert.equal(b.length, 44 + left.length * 4);
});

test('amostras fora de [-1, 1] são limitadas', () => {
  const f = path.join(tmp, 'clip.wav');
  writeAudio(f, Float32Array.of(2, -2), Float32Array.of(0, 0), rate);
  const b = fs.readFileSync(f);
  assert.equal(b.readInt16LE(44), 0x7fff);
  assert.equal(b.readInt16LE(48), -0x8000);
});

test('MP3 começa com quadro MPEG válido', () => {
  const f = path.join(tmp, 'a.mp3');
  writeAudio(f, left, right, rate);
  const b = fs.readFileSync(f);
  assert.ok(b.length > 1000, `mp3 pequeno demais: ${b.length}`);
  assert.equal(b[0], 0xff);
  assert.equal(b[1] & 0xe0, 0xe0);
});
