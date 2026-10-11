/* Обработчик звука с микрофона: собирает куски по 2048 отсчётов и отдаёт их странице (src/components/ToneMic.jsx).
   Работает в отдельном потоке звука браузера; ничего не сохраняет и никуда не отправляет. */
class Grab extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(2048); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) {
      for (let i = 0; i < ch.length; i++) {
        this.buf[this.n++] = ch[i];
        if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
      }
    }
    return true;
  }
}
registerProcessor('nn-grab', Grab);
