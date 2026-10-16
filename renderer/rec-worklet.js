// Captura o que sai do mestre, bloco a bloco, para exportar.
class Rec extends AudioWorkletProcessor {
  process(inputs) {
    const i = inputs[0];
    const l = i[0] ? i[0].slice() : new Float32Array(128);
    const r = i[1] ? i[1].slice() : l.slice();
    this.port.postMessage([l, r]);
    return true;
  }
}
registerProcessor('rec', Rec);
