// Exporta o áudio capturado (Float32 por canal) para WAV 16-bit ou MP3 192 kbps.
const fs = require('fs');
const vm = require('vm');
const path = require('path');

// o pacote npm do lamejs 1.2.1 quebra no require (MPEGMode is not defined); o bundle lame.all.js funciona
let lame;
function lamejs() {
  if (!lame) {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(fs.readFileSync(require.resolve('lamejs/lame.all.js'), 'utf8') + ';this.lamejs = lamejs;', ctx);
    lame = ctx.lamejs;
  }
  return lame;
}

const toInt16 = f => {
  const out = new Int16Array(f.length);
  for (let i = 0; i < f.length; i++) {
    const s = Math.max(-1, Math.min(1, f[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
};

function wav(left, right, rate) {
  const n = left.length, data = n * 4;
  const b = Buffer.alloc(44 + data);
  b.write('RIFF', 0); b.writeUInt32LE(36 + data, 4); b.write('WAVE', 8);
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(2, 22);
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 4, 28); b.writeUInt16LE(4, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(data, 40);
  const L = toInt16(left), R = toInt16(right);
  for (let i = 0, o = 44; i < n; i++, o += 4) { b.writeInt16LE(L[i], o); b.writeInt16LE(R[i], o + 2); }
  return b;
}

function mp3(left, right, rate) {
  const enc = new (lamejs().Mp3Encoder)(2, rate, 192);
  const L = toInt16(left), R = toInt16(right);
  const parts = [];
  for (let i = 0; i < L.length; i += 1152) {
    const chunk = enc.encodeBuffer(L.subarray(i, i + 1152), R.subarray(i, i + 1152));
    if (chunk.length) parts.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.length));
  }
  const end = enc.flush();
  if (end.length) parts.push(Buffer.from(end.buffer, end.byteOffset, end.length));
  return Buffer.concat(parts);
}

function writeAudio(file, left, right, rate) {
  const buf = path.extname(file).toLowerCase() === '.mp3' ? mp3(left, right, rate) : wav(left, right, rate);
  fs.writeFileSync(file, buf);
  return buf.length;
}

module.exports = { writeAudio };
