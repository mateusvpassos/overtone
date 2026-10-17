// Overtone — recursos de estúdio: salvamento automático, contagem, quantizar, arpejador, cenas,
// pan/efeito por faixa, stems e MIDI, bateria em passos, editor de notas e editor de sons.
// Carrega depois do app.js e chama boot() no fim.

S.arp ??= { on: false, mode: 'up', rate: '1/16', oct: 1, latch: false, gate: .6 };
S.qGrid ??= '1/16';
S.countIn ??= false;
S.customPresets ??= [];
S.padDrums ??= DRUMS.map(d => d.id);
function padDrum(i) { return DRUM_LIB.find(d => d.id === S.padDrums[i]) || DRUMS[i]; }

const GRID_DIV = { '1/4': 1, '1/8': 2, '1/8T': 3, '1/16': 4, '1/32': 8 };
const beatMs = () => 60000 / S.bpm;
const gridMs = () => beatMs() / GRID_DIV[S.qGrid];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function openModal(id) { $(id).classList.remove('hidden'); }
function closeModal(id) { $(id).classList.add('hidden'); }
for (const m of document.querySelectorAll('.modal-wrap')) {
  m.addEventListener('pointerdown', e => { if (e.target === m) m.classList.add('hidden'); });
  m.querySelector('.m-close')?.addEventListener('click', () => m.classList.add('hidden'));
}
const trackOptions = sel => looper.tracks.map((t, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

// =====================================================================
// salvamento automático: a sessão volta como estava ao abrir o app
// =====================================================================
let autoT;
function autosaveSoon() {
  clearTimeout(autoT);
  autoT = setTimeout(autosaveNow, 1500);
}
function autosaveNow() {
  clearTimeout(autoT);
  if (!window.api) return;
  window.api.autosave({ ...mixData(), meta: { name: mix.name, file: mix.file, dirty: mix.dirty } });
}
window.addEventListener('beforeunload', autosaveNow);

async function restoreAutosave() {
  const d = await window.api.autosaveLoad();
  if (!d || !(d.tracks || []).some(t => t.events?.length)) return;
  applyMixData(d);
  Object.assign(mix, { name: d.meta?.name || '', file: d.meta?.file || null, dirty: d.meta?.dirty ?? true });
  renderMixName();
  toast(icon('undo') + 'Sessão anterior recuperada');
}

// =====================================================================
// contagem de 1 compasso antes de gravar
// =====================================================================
function countIn(onStart, playAfter) {
  toggleMetro(true); // reinicia o metrônomo alinhado com a contagem
  const start = now() + 50 + 4 * beatMs();
  looper.counting = start;
  looper.start = start;
  if (playAfter) {
    looper.playing = true;
    looper.last = -1;
    ensureTimer();
  }
  onStart?.();
  renderLoops();
}
function renderCount() { $('#t-count').classList.toggle('on', S.countIn); }
$('#t-count').addEventListener('click', () => { S.countIn = !S.countIn; renderCount(); save(); });

// =====================================================================
// quantizar: encaixa o início das notas na grade (o fim anda junto)
// =====================================================================
function quantizeTrack(ti = looper.sel, strength = 1) {
  const tr = looper.tracks[ti];
  if (!looper.len) return toast(icon('grid') + 'Grave um loop antes de quantizar');
  if (!tr?.events.length) return toast(icon('grid') + 'Essa faixa está vazia');
  snapshot();
  releaseLoop(ti);
  const g = gridMs(), r = looper.range?.ti === ti ? looper.range : null;
  tr.events = fromBlocks(toBlocks(tr).map(b => {
    if (r && (b.t < r.a || b.t >= r.b)) return b;
    const d = (Math.round(b.t / g) * g - b.t) * strength;
    let t = b.t + d, end = b.end + d;
    if (t >= looper.len - 1) { t -= looper.len; end -= looper.len; } // passou do fim: volta pro começo
    t = Math.max(0, t);
    return { ...b, t, end: clamp(end, t + 15, looper.len - 1) };
  }));
  drawLane(ti);
  renderLoops();
  if (!$('#roll-modal').classList.contains('hidden')) rollLoad();
  toast(icon('grid') + `${escapeHtml(tr.name)} quantizado em ${S.qGrid}${strength < 1 ? ' (50%)' : ''}`);
}
$('#q-grid').addEventListener('change', e => { S.qGrid = e.target.value; save(); if (!$('#roll-modal').classList.contains('hidden')) rollRender(); });
$('#btn-quant').addEventListener('click', e => quantizeTrack(looper.sel, e.shiftKey ? .5 : 1));

// =====================================================================
// arpejador: as entradas de nota (teclado, PC, mouse, acordes) passam por aqui
// =====================================================================
const ARP = { held: new Map(), down: new Set(), seq: 0, idx: 0, next: 0, timer: null, offT: null };
const arpStepMs = () => beatMs() / GRID_DIV[S.arp.rate];

function noteIn(src, notes, vel) {
  if (!S.arp.on) return startNotes(src, notes, vel);
  if (S.arp.latch && !ARP.down.size) ARP.held.clear(); // trava: a mão nova substitui o acorde
  ARP.down.add(src);
  ARP.held.set(src, { notes, vel, at: ARP.seq++ });
  showArpKeys();
  if (!ARP.timer) arpStart();
}
function noteOut(src) {
  if (!ARP.held.has(src)) return stopSrc(src);
  ARP.down.delete(src);
  if (S.arp.latch) return;
  ARP.held.delete(src);
  showArpKeys();
  if (!ARP.held.size) arpStop();
}

function arpList() {
  let base = [...ARP.held.values()].sort((a, b) => a.at - b.at).flatMap(h => h.notes);
  if (S.arp.mode !== 'played') base = [...new Set(base)].sort((a, b) => a - b);
  const out = [];
  for (let o = 0; o < S.arp.oct; o++) out.push(...base.map(n => n + 12 * o));
  if (S.arp.mode === 'down') out.reverse();
  if (S.arp.mode === 'updown' && out.length > 2) out.push(...out.slice(1, -1).reverse());
  return out;
}
function arpStep() {
  const list = arpList();
  if (!list.length) return;
  const n = S.arp.mode === 'random' ? list[Math.floor(Math.random() * list.length)] : list[ARP.idx++ % list.length];
  const vel = Math.max(...[...ARP.held.values()].map(h => h.vel));
  startNotes('arp', [n], vel);
  clearTimeout(ARP.offT);
  ARP.offT = setTimeout(() => stopSrc('arp'), arpStepMs() * S.arp.gate);
}
function arpStart() {
  ARP.idx = 0;
  const step = arpStepMs();
  // com o loop tocando, entra na grade do loop
  ARP.next = looper.playing && looper.len ? looper.start + Math.ceil((now() - looper.start) / step) * step : now();
  if (ARP.next - now() > step * .5) ARP.next -= step * Math.floor((ARP.next - now()) / step);
  ARP.timer = setInterval(() => {
    let guard = 0;
    while (now() >= ARP.next && guard++ < 4) { arpStep(); ARP.next += arpStepMs(); }
  }, 3);
}
function arpStop() {
  clearInterval(ARP.timer);
  ARP.timer = null;
}
function arpOff() {
  ARP.held.clear();
  ARP.down.clear();
  arpStop();
  stopSrc('arp');
  showArpKeys();
}
// teclas seguradas aparecem no teclado da tela mesmo com o arpejo tocando só uma
function showArpKeys() {
  const on = new Set([...ARP.held.values()].flatMap(h => h.notes));
  for (const el of document.querySelectorAll('#keyboard [data-n]')) el.classList.toggle('arp-held', on.has(+el.dataset.n));
}
function renderArp() {
  $('#arp-on').checked = S.arp.on;
  $('#arp-mode').value = S.arp.mode;
  $('#arp-rate').value = S.arp.rate;
  $('#arp-oct').value = S.arp.oct;
  $('#arp-latch').checked = S.arp.latch;
  document.querySelector('.arp').classList.toggle('on', S.arp.on);
}
function setArp(k, v) {
  S.arp[k] = v;
  if (k === 'on' && !v) arpOff();
  if (k === 'latch' && !v) { for (const s of [...ARP.held.keys()]) if (!ARP.down.has(s)) ARP.held.delete(s); if (!ARP.held.size) arpStop(); showArpKeys(); }
  renderArp();
  save();
}
$('#arp-on').addEventListener('change', e => setArp('on', e.target.checked));
$('#arp-mode').addEventListener('change', e => setArp('mode', e.target.value));
$('#arp-rate').addEventListener('change', e => setArp('rate', e.target.value));
$('#arp-oct').addEventListener('change', e => setArp('oct', +e.target.value));
$('#arp-latch').addEventListener('change', e => setArp('latch', e.target.checked));

// =====================================================================
// cenas: quais faixas tocam (e com que volume); troca na virada do loop
// =====================================================================
const scenes = { list: [], cur: -1, pending: null };
const SCENE_NAMES = 'ABCDEFGH';
const SCENE_COLORS = ['#22c3e6', '#ff9f6e', '#c084fc', '#3ddc97', '#fbbf24', '#f472b6', '#a3e635', '#6f8bff'];

function sceneSave(i) {
  scenes.list[i] = {
    name: 'Cena ' + SCENE_NAMES[i],
    mutes: Object.fromEntries(looper.tracks.map(t => [t.id, t.mute])),
    vols: Object.fromEntries(looper.tracks.map(t => [t.id, t.vol]))
  };
  scenes.cur = i;
  markDirty();
  renderScenes();
  renderPads();
  toast(icon('layers') + `Cena ${SCENE_NAMES[i]} gravada com as faixas ligadas agora`);
}
function sceneClear(i) {
  scenes.list[i] = null;
  if (scenes.cur === i) scenes.cur = -1;
  markDirty();
  renderScenes();
  renderPads();
}
function sceneRecall(i) {
  if (!scenes.list[i]) return sceneSave(i);
  if (looper.playing && looper.len) { scenes.pending = i; renderScenes(); renderPads(); }
  else applyScene(i);
}
function applyScene(i) {
  const sc = scenes.list[i];
  scenes.pending = null;
  if (!sc) return;
  looper.tracks.forEach((t, ti) => {
    if (t.id in sc.mutes) {
      if (sc.mutes[t.id] && !t.mute) releaseLoop(ti);
      t.mute = sc.mutes[t.id];
    }
    if (t.id in sc.vols) { t.vol = sc.vols[t.id]; t.bus.set(t.vol ** 1.5); }
  });
  scenes.cur = i;
  renderLoops();
  renderScenes();
}
// chamado pelo loopTick: aplica a cena pendente quando o loop dá a volta
function sceneTick() {
  if (scenes.pending !== null && loopPos() < looper.last) applyScene(scenes.pending);
}
function sceneInfo(i) {
  const sc = scenes.list[i];
  return {
    name: 'Cena ' + SCENE_NAMES[i],
    sub: scenes.pending === i ? 'na próxima volta' : sc ? `${looper.tracks.filter(t => sc.mutes[t.id] === false).length} faixas` : 'vazia · bata p/ gravar',
    c: SCENE_COLORS[i], lit: scenes.cur === i
  };
}
function renderScenes() {
  $('#scene-bar').innerHTML = SCENE_NAMES.split('').map((n, i) => `
    <button class="scene ${scenes.list[i] ? 'has' : ''} ${scenes.cur === i ? 'on' : ''} ${scenes.pending === i ? 'pending' : ''}"
      data-i="${i}" style="--c:${SCENE_COLORS[i]}" title="${scenes.list[i] ? 'Toca a cena ' + n + ' · Shift grava por cima · Alt apaga' : 'Vazia · clique grava as faixas ligadas agora'}">${n}</button>`).join('');
}
$('#scene-bar').addEventListener('click', e => {
  const b = e.target.closest('.scene');
  if (!b) return;
  const i = +b.dataset.i;
  if (e.altKey) return sceneClear(i);
  if (e.shiftKey) return sceneSave(i);
  sceneRecall(i);
});

// =====================================================================
// faixa: pan, efeito, cor e atalhos para os editores
// =====================================================================
let popTi = null;
function openTrackPop(i, anchor) {
  popTi = i;
  const tr = looper.tracks[i], pop = $('#track-pop'), r = anchor.getBoundingClientRect();
  pop.style.setProperty('--c', tr.c);
  $('#tp-name').textContent = tr.name;
  $('#tp-pan').value = tr.pan;
  $('#tp-fx').value = tr.fx;
  $('#tp-colors').innerHTML = LOOP_COLORS.map(c => `<button class="sw ${c === tr.c ? 'on' : ''}" data-c="${c}" style="--c:${c}"></button>`).join('');
  renderPopVals();
  pop.classList.remove('hidden');
  const h = pop.offsetHeight, w = pop.offsetWidth;
  pop.style.left = clamp(r.right - w, 8, innerWidth - w - 8) + 'px';
  pop.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8) + 'px';
}
function renderPopVals() {
  const tr = looper.tracks[popTi];
  const p = Math.round(tr.pan * 100);
  $('#tp-pan-v').textContent = p === 0 ? 'C' : p < 0 ? `E${-p}` : `D${p}`;
  $('#tp-fx-v').textContent = Math.round(tr.fx * 100) + '%';
}
$('#tp-pan').addEventListener('input', e => { const tr = looper.tracks[popTi]; tr.pan = +e.target.value; tr.bus.setPan(tr.pan); renderPopVals(); markDirty(); });
$('#tp-pan').addEventListener('dblclick', e => { e.target.value = 0; e.target.dispatchEvent(new Event('input')); });
$('#tp-fx').addEventListener('input', e => { const tr = looper.tracks[popTi]; tr.fx = +e.target.value; tr.bus.setFx(tr.fx); renderPopVals(); markDirty(); });
$('#tp-colors').addEventListener('click', e => {
  const b = e.target.closest('.sw');
  if (!b) return;
  looper.tracks[popTi].c = b.dataset.c;
  $('#track-pop').style.setProperty('--c', b.dataset.c);
  for (const s of document.querySelectorAll('#tp-colors .sw')) s.classList.toggle('on', s === b);
  markDirty();
  renderLoops();
});
document.querySelector('#track-pop .pop-acts').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = popTi;
  $('#track-pop').classList.add('hidden');
  looper.sel = i;
  renderLoops();
  ({ quant: () => quantizeTrack(i), roll: () => openRoll(i), seq: () => openSeq(i) })[b.dataset.a]();
});
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#track-pop, .l-more')) $('#track-pop').classList.add('hidden');
});

// =====================================================================
// exportar: mix, faixas separadas (cada uma solo) ou MIDI
// =====================================================================
exp.what = 'mix';
const _renderExport = renderExport;
renderExport = function () {
  _renderExport();
  for (const b of document.querySelectorAll('#x-what button')) b.classList.toggle('on', b.dataset.w === exp.what);
  $('#x-format-row').classList.toggle('hidden', exp.what === 'midi');
  $('#x-tail').closest('label').classList.toggle('hidden', exp.what === 'midi');
  const filled = looper.tracks.filter(t => t.events.length).length;
  if (looper.len && exp.what === 'stems') $('#x-sum').textContent = `${filled} faixas, uma de cada vez · ${exp.reps} ${exp.reps === 1 ? 'volta' : 'voltas'} cada ≈ ${(filled * (looper.len * exp.reps / 1000 + (exp.tail ? 2.5 : 0))).toFixed(0)}s gravando`;
  if (looper.len && exp.what === 'midi') $('#x-sum').textContent = `${filled} faixas · ${exp.reps} ${exp.reps === 1 ? 'volta' : 'voltas'} · ${S.bpm} bpm · bateria no canal 10 (General MIDI) · instantâneo`;
  $('#x-go').innerHTML = icon('download') + (exp.what === 'midi' ? 'Salvar .mid' : exp.what === 'stems' ? 'Gravar faixas' : 'Gravar e exportar');
};
$('#x-what').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { exp.what = b.dataset.w; renderExport(); } });

// grava N voltas + cauda; devolve o áudio ou null se cancelou
async function captureLoop(job, label) {
  loopPlay(false);
  await Engine.startCapture();
  loopPlay(true);
  const total = looper.len * exp.reps, tail = exp.tail ? 2500 : 150;
  await new Promise(res => {
    const tick = () => {
      const t = now() - looper.start;
      $('#x-bar').style.width = Math.min(100, t / (total + tail) * 100) + '%';
      $('#x-status').textContent = (label ? label + ' · ' : '') + (t < total ? `volta ${Math.min(exp.reps, Math.floor(t / looper.len) + 1)}/${exp.reps}` : 'cauda');
      if (job.cancel) return res();
      if (t >= total && looper.playing) loopPlay(false);
      if (t >= total + tail) return res();
      requestAnimationFrame(tick);
    };
    tick();
  });
  if (looper.playing) loopPlay(false);
  const pcm = Engine.stopCapture();
  return job.cancel ? null : pcm;
}

const _runExport = runExport;
runExport = async function () {
  if (exp.what === 'mix') return _runExport();
  if (!looper.len || exp.running) return;
  if (looper.rec !== null) endRec();
  if (exp.what === 'midi') {
    const bytes = midiFile(exp.reps);
    const res = await window.api.saveFile(`${mix.name || 'overtone'}.mid`, 'mid', bytes);
    if (res) { exp.last = res; toast(icon('check') + `MIDI salvo: ${escapeHtml(res.file.split(/[\\/]/).pop())}`); }
    return renderExport();
  }
  // faixas separadas
  const dir = await window.api.pickFolder();
  if (!dir) return;
  const job = exp.running = { cancel: false };
  exp.last = null;
  renderExport();
  const mutes = looper.tracks.map(t => t.mute);
  const todo = looper.tracks.map((t, i) => i).filter(i => looper.tracks[i].events.length && !mutes[i]);
  let done = 0, lastFile = null;
  for (const [n, i] of todo.entries()) {
    looper.tracks.forEach((t, j) => { t.mute = j !== i; });
    const pcm = await captureLoop(job, `${looper.tracks[i].name} (${n + 1}/${todo.length})`);
    if (!pcm) break;
    const name = `${mix.name || 'overtone'} - ${String(n + 1).padStart(2, '0')} ${looper.tracks[i].name}`;
    lastFile = await window.api.writeAudioTo(dir, name, exp.format, pcm.rate, pcm.left, pcm.right);
    done++;
  }
  looper.tracks.forEach((t, j) => { t.mute = mutes[j]; });
  exp.running = null;
  renderLoops();
  if (job.cancel) toast(icon('x') + `Cancelado · ${done} faixa(s) salvas`);
  else if (lastFile) { exp.last = { file: lastFile }; toast(icon('check') + `${done} faixas exportadas`); }
  renderExport();
};
// os listeners do app.js chamam a função antiga: troca pelos novos
$('#x-go').replaceWith($('#x-go').cloneNode(true));
$('#x-go').addEventListener('click', () => runExport());

// arquivo MIDI tipo 1: faixa de tempo + uma por faixa de loop
const GM_DRUM = { kick: 36, snare: 38, hat: 42, openhat: 46, clap: 39, tom: 45, cowbell: 56, crash: 49, tom2: 41, rim: 37, ghost: 38, pedalhat: 44,
  ride: 51, ridebell: 53, shaker: 70, tamb: 54, conga: 63, bongo: 60, cajon: 35, cajonslap: 40, claves: 75, woodblock: 76, triangle: 81 };
function midiFile(reps = 1) {
  const PPQ = 480, tick = ms => Math.round(ms / beatMs() * PPQ);
  const vlq = n => { const b = [n & 0x7f]; while ((n >>= 7)) b.unshift((n & 0x7f) | 0x80); return b; };
  const str = s => [...s].map(c => c.charCodeAt(0) & 0x7f);
  const u32 = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  const meta = (type, bytes) => [0xff, type, ...vlq(bytes.length), ...bytes];
  const chunk = evs => {
    evs.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const data = [];
    let last = 0;
    for (const e of evs) { data.push(...vlq(e.tick - last), ...e.bytes); last = e.tick; }
    data.push(0, 0xff, 0x2f, 0);
    return [...str('MTrk'), ...u32(data.length), ...data];
  };
  const us = Math.round(60000000 / S.bpm);
  const tracks = [chunk([
    { tick: 0, order: 0, bytes: meta(0x03, str(mix.name || 'Overtone')) },
    { tick: 0, order: 0, bytes: meta(0x51, [(us >> 16) & 255, (us >> 8) & 255, us & 255]) },
    { tick: 0, order: 0, bytes: meta(0x58, [4, 2, 24, 8]) }
  ])];
  let ch = 0;
  for (const tr of looper.tracks) {
    if (!tr.events.length) continue;
    if (ch === 9) ch++;
    const mch = ch++ % 16;
    const evs = [{ tick: 0, order: 0, bytes: meta(0x03, str(tr.name)) }];
    const vol = Math.round(clamp(tr.vol, 0, 1) * 127), pan = Math.round((tr.pan + 1) * 63.5);
    evs.push({ tick: 0, order: 0, bytes: [0xb0 | mch, 7, vol] }, { tick: 0, order: 0, bytes: [0xb0 | mch, 10, clamp(pan, 0, 127)] });
    for (let r = 0; r < reps; r++) {
      const off = r * looper.len;
      for (const b of toBlocks(tr)) {
        const v = clamp(Math.round(b.vel || 100), 1, 127);
        if (b.type === 'drum') {
          const n = GM_DRUM[b.id] || 37;
          evs.push({ tick: tick(off + b.t), order: 1, bytes: [0x99, n, v] }, { tick: tick(off + b.t + 60), order: 0, bytes: [0x89, n, 0] });
        } else for (const n of b.notes) {
          evs.push({ tick: tick(off + b.t), order: 1, bytes: [0x90 | mch, n, v] }, { tick: tick(off + Math.max(b.end, b.t + 10)), order: 0, bytes: [0x80 | mch, n, 0] });
        }
      }
    }
    tracks.push(chunk(evs));
  }
  return new Uint8Array([...str('MThd'), ...u32(6), 0, 1, (tracks.length >> 8) & 255, tracks.length & 255, (PPQ >> 8) & 255, PPQ & 255, ...tracks.flat()]);
}

// =====================================================================
// bateria em passos (step sequencer) na faixa escolhida
// =====================================================================
const SEQ = { ti: 0, paint: null };
function ensureLoop() {
  if (looper.len) return;
  // sem loop ainda: cria um compasso vazio e começa a tocar
  looper.len = 4 * beatMs();
  looper.playing = true;
  looper.start = now();
  looper.last = -1;
  ensureTimer();
  renderLoops();
}
const seqSteps = () => clamp(Math.round(looper.len / (beatMs() / 4)), 4, 64);
function openSeq(ti = looper.sel) {
  ensureLoop();
  SEQ.ti = ti;
  openModal('#seq-modal');
  seqRender();
}
function seqHas(tr, id, k, step) {
  return tr.events.some(e => e.type === 'drum' && e.id === id && Math.abs(e.t - k * step) < step / 2);
}
function seqRender() {
  const tr = looper.tracks[SEQ.ti], n = seqSteps(), step = looper.len / n;
  $('#seq-track').innerHTML = trackOptions(SEQ.ti);
  $('#seq-kit').innerHTML = KITS.map(k => `<button data-k="${k.id}" class="${k.id === S.kit ? 'on' : ''}">${k.name}</button>`).join('');
  $('#seq-info').textContent = `${n} passos · ${(looper.len / 1000).toFixed(2)}s`;
  const grid = $('#seq-grid');
  grid.style.setProperty('--n', n);
  grid.style.setProperty('--c', tr.c);
  const ids = [...new Set([...S.padDrums, ...tr.events.filter(e => e.type === 'drum').map(e => e.id)])];
  grid.innerHTML = ids.map(id => DRUM_LIB.find(d => d.id === id)).filter(Boolean).map(d => `
    <div class="seq-row"><span class="seq-name" style="--dc:${d.c}">${d.name}</span>
      ${Array.from({ length: n }, (_, k) => `<i class="cell ${seqHas(tr, d.id, k, step) ? 'on' : ''} ${k % 4 === 0 ? 'beat' : ''}" data-d="${d.id}" data-k="${k}"></i>`).join('')}
    </div>`).join('');
}
function seqSet(id, k, on, accent) {
  const tr = looper.tracks[SEQ.ti], step = looper.len / seqSteps();
  tr.events = tr.events.filter(e => !(e.type === 'drum' && e.id === id && Math.abs(e.t - k * step) < step / 2));
  if (on) {
    tr.events.push({ type: 'drum', id, vel: accent ? 127 : 100, kit: S.kit, t: k * step + .5, skip: 0 });
    tr.events.sort((a, b) => a.t - b.t);
    if (!looper.playing) Engine.drum(id, accent ? 127 : 100, 0, S.kit, tr.bus);
  }
  drawLane(SEQ.ti);
  markDirty();
}
(() => {
  const grid = $('#seq-grid');
  grid.addEventListener('pointerdown', e => {
    const c = e.target.closest('.cell');
    if (!c) return;
    snapshot();
    SEQ.paint = !c.classList.contains('on');
    c.classList.toggle('on', SEQ.paint);
    seqSet(c.dataset.d, +c.dataset.k, SEQ.paint, e.shiftKey);
  });
  grid.addEventListener('pointerover', e => {
    const c = e.target.closest('.cell');
    if (SEQ.paint === null || !c || c.classList.contains('on') === SEQ.paint) return;
    c.classList.toggle('on', SEQ.paint);
    seqSet(c.dataset.d, +c.dataset.k, SEQ.paint, e.shiftKey);
  });
  window.addEventListener('pointerup', () => { if (SEQ.paint !== null) { SEQ.paint = null; renderLoops(); } });
})();
$('#seq-track').addEventListener('change', e => { SEQ.ti = +e.target.value; seqRender(); });
$('#seq-kit').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  S.kit = b.dataset.k;
  Engine.setKit(S.kit);
  // o kit novo vale para a bateria inteira desta faixa
  for (const ev of looper.tracks[SEQ.ti].events) if (ev.type === 'drum') ev.kit = S.kit;
  markDirty();
  renderPads();
  seqRender();
});
$('#seq-clear').addEventListener('click', () => {
  snapshot();
  const tr = looper.tracks[SEQ.ti];
  tr.events = tr.events.filter(e => e.type !== 'drum');
  drawLane(SEQ.ti);
  renderLoops();
  seqRender();
});
$('#btn-seq').addEventListener('click', () => openSeq());

// =====================================================================
// editor de notas (piano-roll) da faixa escolhida
// =====================================================================
const ROW_H = 15;
const ROLL = { ti: 0, notes: [], drums: [], lo: 48, hi: 72, sel: null, drag: null };
const isBlack = n => [1, 3, 6, 8, 10].includes(n % 12);

function openRoll(ti = looper.sel) {
  ensureLoop();
  ROLL.ti = ti;
  ROLL.sel = null;
  openModal('#roll-modal');
  rollLoad();
}
function rollLoad() {
  const tr = looper.tracks[ROLL.ti], blocks = toBlocks(tr);
  ROLL.drums = blocks.filter(b => b.type === 'drum');
  ROLL.notes = blocks.filter(b => b.type !== 'drum').flatMap(b => b.notes.map(n => ({ note: n, t: b.t, end: b.end, vel: b.vel || 100, preset: b.preset || S.preset })));
  const ns = ROLL.notes.map(n => n.note);
  const lo = ns.length ? Math.min(...ns) : 60, hi = ns.length ? Math.max(...ns) : 60;
  ROLL.lo = Math.max(0, Math.min(lo - 4, Math.floor((lo + hi) / 2) - 12));
  ROLL.hi = Math.min(127, Math.max(hi + 4, ROLL.lo + 24));
  rollRender();
}
function rollCommit() {
  const tr = looper.tracks[ROLL.ti];
  releaseLoop(ROLL.ti);
  tr.events = fromBlocks([...ROLL.drums, ...ROLL.notes.map(n => ({ type: 'on', notes: [n.note], vel: n.vel, preset: n.preset, t: n.t, end: n.end }))]);
  drawLane(ROLL.ti);
  renderLoops();
  markDirty();
}
function rollRender() {
  const tr = looper.tracks[ROLL.ti], rows = ROLL.hi - ROLL.lo + 1;
  $('#roll-track').innerHTML = trackOptions(ROLL.ti);
  $('#roll-info').textContent = `${ROLL.notes.length} notas · grade ${S.qGrid}${ROLL.drums.length ? ` · ${ROLL.drums.length} batidas de bateria (edite em Passos)` : ''}`;
  let keys = '';
  for (let n = ROLL.hi; n >= ROLL.lo; n--) keys += `<div class="rk ${isBlack(n) ? 'b' : ''}">${n % 12 === 0 ? noteName(n) : ''}</div>`;
  $('#roll-keys').innerHTML = keys;
  const grid = $('#roll-grid');
  grid.style.height = rows * ROW_H + 'px';
  grid.style.setProperty('--c', tr.c);
  grid.style.setProperty('--gx', gridMs() / looper.len * 100 + '%');
  grid.style.setProperty('--bx', beatMs() / looper.len * 100 + '%');
  let lanes = '';
  for (let n = ROLL.hi; n >= ROLL.lo; n--) if (isBlack(n)) lanes += `<i class="rl" style="top:${(ROLL.hi - n) * ROW_H}px"></i>`;
  grid.innerHTML = lanes + ROLL.notes.map((n, i) => `
    <b class="rn ${ROLL.sel === i ? 'sel' : ''}" data-i="${i}" style="left:${n.t / looper.len * 100}%;width:${Math.max(.3, (n.end - n.t) / looper.len * 100)}%;top:${(ROLL.hi - n.note) * ROW_H}px;opacity:${.45 + n.vel / 127 * .55}"></b>`).join('') + '<span id="roll-head"></span>';
}
function rollPreview(n) {
  const v = Engine.noteOn(n.note, n.vel, n.preset);
  setTimeout(() => Engine.noteOff(v), 180);
}
(() => {
  const grid = $('#roll-grid');
  const at = e => {
    const r = grid.getBoundingClientRect();
    return { t: clamp((e.clientX - r.left) / r.width, 0, 1) * looper.len, note: clamp(ROLL.hi - Math.floor((e.clientY - r.top) / ROW_H), ROLL.lo, ROLL.hi), x: e.clientX };
  };
  const snap = (t, e) => e.altKey ? t : Math.floor(t / gridMs()) * gridMs();
  grid.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    const p = at(e), el = e.target.closest('.rn');
    snapshot();
    if (el) {
      const i = +el.dataset.i, n = ROLL.notes[i], r = el.getBoundingClientRect();
      ROLL.sel = i;
      ROLL.drag = { i, mode: e.clientX > r.right - 7 ? 'size' : 'move', t0: p.t, n0: p.note, orig: { ...n } };
    } else {
      const t = snap(p.t, e);
      const n = { note: p.note, t, end: Math.min(looper.len - 1, t + gridMs()), vel: 100, preset: S.preset };
      ROLL.notes.push(n);
      ROLL.sel = ROLL.notes.length - 1;
      ROLL.drag = { i: ROLL.sel, mode: 'size', t0: p.t, n0: p.note, orig: { ...n } };
      rollPreview(n);
    }
    grid.setPointerCapture(e.pointerId);
    rollRender();
  });
  grid.addEventListener('pointermove', e => {
    const d = ROLL.drag;
    if (!d) {
      const el = e.target.closest('.rn');
      grid.style.cursor = el && e.clientX > el.getBoundingClientRect().right - 7 ? 'ew-resize' : el ? 'grab' : 'crosshair';
      return;
    }
    const p = at(e), n = ROLL.notes[d.i], o = d.orig, len = o.end - o.t;
    if (d.mode === 'move') {
      const t = clamp(e.altKey ? o.t + (p.t - d.t0) : Math.round((o.t + p.t - d.t0) / gridMs()) * gridMs(), 0, looper.len - len - 1);
      const note = clamp(o.note + p.note - d.n0, 0, 127);
      if (note !== n.note) rollPreview({ ...n, note });
      Object.assign(n, { t, end: t + len, note });
    } else {
      const end = e.altKey ? p.t : Math.ceil(p.t / gridMs()) * gridMs();
      n.end = clamp(end, n.t + 15, looper.len - 1);
    }
    rollRender();
  });
  const end = () => { if (ROLL.drag) { ROLL.drag = null; rollCommit(); } };
  grid.addEventListener('pointerup', end);
  grid.addEventListener('pointercancel', end);
  grid.addEventListener('dblclick', e => {
    const el = e.target.closest('.rn');
    if (!el) return;
    ROLL.notes.splice(+el.dataset.i, 1);
    ROLL.sel = null;
    rollCommit();
    rollRender();
  });
  grid.addEventListener('contextmenu', e => {
    e.preventDefault();
    const el = e.target.closest('.rn');
    if (!el) return;
    snapshot();
    ROLL.notes.splice(+el.dataset.i, 1);
    ROLL.sel = null;
    rollCommit();
    rollRender();
  });
  grid.addEventListener('wheel', e => {
    const el = e.target.closest('.rn');
    if (!el) return;
    e.preventDefault();
    const n = ROLL.notes[+el.dataset.i];
    n.vel = clamp(n.vel - Math.sign(e.deltaY) * 8, 10, 127);
    ROLL.sel = +el.dataset.i;
    rollRender();
    clearTimeout(ROLL.velT);
    ROLL.velT = setTimeout(rollCommit, 300);
    $('#roll-info').textContent = `força ${n.vel}`;
  }, { passive: false });
})();
$('#roll-track').addEventListener('change', e => { ROLL.ti = +e.target.value; ROLL.sel = null; rollLoad(); });
$('#roll-quant').addEventListener('click', e => quantizeTrack(ROLL.ti, e.shiftKey ? .5 : 1));
$('#btn-roll').addEventListener('click', () => openRoll());
window.addEventListener('keydown', e => {
  if ($('#roll-modal').classList.contains('hidden') || ROLL.sel === null) return;
  if (e.code === 'Delete' || e.code === 'Backspace') {
    e.stopImmediatePropagation();
    snapshot();
    ROLL.notes.splice(ROLL.sel, 1);
    ROLL.sel = null;
    rollCommit();
    rollRender();
  }
}, true);

// cabeças de leitura dos editores
(() => {
  const frame = () => {
    requestAnimationFrame(frame);
    if (looper.counting && now() < looper.counting) {
      $('#loop-info').textContent = `contagem ${4 - Math.floor((looper.counting - now()) / beatMs())}…`;
    } else if (looper.counting) { looper.counting = 0; renderLoops(); }
    const playing = looper.playing && looper.len && now() >= looper.start;
    if (!$('#roll-modal').classList.contains('hidden')) {
      const h = $('#roll-head');
      if (h) { h.style.display = playing ? 'block' : 'none'; h.style.left = loopPos() / looper.len * 100 + '%'; }
    }
    if (!$('#seq-modal').classList.contains('hidden')) {
      const k = playing ? Math.floor(loopPos() / (looper.len / seqSteps())) : -1;
      if (k !== SEQ.col) {
        SEQ.col = k;
        for (const c of document.querySelectorAll('#seq-grid .cell')) c.classList.toggle('now', +c.dataset.k === k);
      }
    }
  };
  frame();
})();

// =====================================================================
// editor de sons próprios ("Meus sons")
// =====================================================================
function customPresets() {
  return PRESETS.filter(p => p.custom).map(p => JSON.parse(JSON.stringify(p)));
}
function addCustomPreset(p) {
  if (!p?.id || PRESETS.some(x => x.id === p.id)) return;
  PRESETS.push({ ...p, custom: true, cat: 'Meus sons', icon: p.icon || 'sparkle' });
  renderSounds();
}
function persistCustom() {
  S.customPresets = customPresets();
  save();
  renderSounds();
  document.querySelector(`.sound[data-id="${S.preset}"]`)?.classList.add('on');
}
S.customPresets.forEach(addCustomPreset);

const SY = { p: null };
const WAVES = [['', 'desligado'], ['sine', 'senoide'], ['triangle', 'triângulo'], ['square', 'quadrada'], ['sawtooth', 'serra']];
const RATIOS = [.25, .5, 1, 1.5, 2, 3, 4];
const SWATCH = ['#ffbf47', '#22c3e6', '#6f8bff', '#ff5d6c', '#3ddc97', '#c084fc', '#5ef0b0', '#ff9f6e', '#f472b6', '#a3e635'];

function newSound() {
  const base = PRESETS.find(p => p.id === S.preset) || PRESETS[0];
  const p = JSON.parse(JSON.stringify(base));
  const count = PRESETS.filter(x => x.custom).length + 1;
  Object.assign(p, { id: 'u' + Date.now().toString(36), name: `Meu som ${count}`, desc: `Feito a partir de ${base.name}`, custom: true, cat: 'Meus sons', icon: 'sparkle' });
  PRESETS.push(p);
  persistCustom();
  setPreset(p.id);
  openSynth(p.id);
}

function openSynth(id) {
  SY.p = PRESETS.find(p => p.id === id);
  if (!SY.p) return;
  $('#sy-name').value = SY.p.name;
  synthRender();
  openModal('#synth-modal');
}

// slider: [rótulo, caminho, min, max, passo, escala log?, formato]
function syGet(path) { return path.split('.').reduce((o, k) => o?.[k], SY.p); }
function sySet(path, v) {
  const ks = path.split('.');
  let o = SY.p;
  for (const k of ks.slice(0, -1)) o = o[k] ??= {};
  o[ks.at(-1)] = v;
}
function slider(label, path, min, max, step, fmt, log) {
  const v = syGet(path) ?? (min < 0 ? 0 : min);
  const pos = log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
  return `<label class="sy-s"><span>${label}</span><input type="range" min="0" max="1" step="0.001" value="${clamp(pos, 0, 1)}"
    data-path="${path}" data-min="${min}" data-max="${max}" data-step="${step}" data-log="${log ? 1 : ''}" data-fmt="${fmt}"><em>${syFmt(fmt, v)}</em></label>`;
}
function syFmt(fmt, v) {
  if (fmt === 'hz') return v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v) + '';
  if (fmt === 's') return v < 1 ? Math.round(v * 1000) + 'ms' : v.toFixed(2) + 's';
  if (fmt === '%') return Math.round(v * 100) + '%';
  if (fmt === 'c') return (v > 0 ? '+' : '') + Math.round(v);
  return (+v).toFixed(fmt === 'x' ? 2 : 1);
}

function synthRender() {
  const p = SY.p;
  $('#sy-del').classList.toggle('hidden', !p.custom);
  const oscs = [0, 1, 2].map(i => {
    const o = p.osc[i];
    return `<div class="sy-osc ${o ? '' : 'off'}" data-i="${i}">
      <span class="sy-t">Osc ${i + 1}</span>
      <select data-osc="${i}" data-k="type">${WAVES.map(([v, n]) => `<option value="${v}" ${(o?.type || '') === v ? 'selected' : ''}>${n}</option>`).join('')}</select>
      ${o ? `<select data-osc="${i}" data-k="ratio" title="Oitava / intervalo">${RATIOS.map(r => `<option value="${r}" ${(o.ratio || 1) === r ? 'selected' : ''}>×${r}</option>`).join('')}</select>
      ${slider('Volume', `osc.${i}.gain`, 0, .8, .01, '%')}
      ${slider('Desafinar', `osc.${i}.detune`, -50, 50, 1, 'c')}` : ''}
    </div>`;
  }).join('');
  $('#sy-body').innerHTML = `
    <div class="sy-top">
      <div class="sy-colors">${SWATCH.map(c => `<button class="sw ${c === p.c ? 'on' : ''}" data-c="${c}" style="--c:${c}"></button>`).join('')}</div>
    </div>
    <div class="sy-sec"><h3>Osciladores</h3>${oscs}</div>
    <div class="sy-cols">
      <div class="sy-sec"><h3>Filtro</h3>
        ${slider('Corte', 'filter.f', 60, 14000, 1, 'hz', true)}
        ${slider('Ressonância', 'filter.q', .1, 18, .1, 'n')}
        ${slider('Envelope', 'filter.env', 0, 6000, 10, 'hz')}
        ${slider('Queda env.', 'filter.envD', .02, 3, .01, 's', true)}
      </div>
      <div class="sy-sec"><h3>Volume (ADSR)</h3>
        ${slider('Ataque', 'env.a', .001, 3, .001, 's', true)}
        ${slider('Queda', 'env.d', .02, 5, .01, 's', true)}
        ${slider('Sustentação', 'env.s', 0, 1, .01, '%')}
        ${slider('Soltura', 'env.r', .02, 4, .01, 's', true)}
      </div>
      <div class="sy-sec"><h3>FM e vibrato</h3>
        <label class="chk"><input type="checkbox" id="sy-fm" ${p.fm ? 'checked' : ''}>FM (metálico / sino)</label>
        ${p.fm ? slider('Razão', 'fm.ratio', .5, 8, .01, 'x') + slider('Intensidade', 'fm.index', 0, 8, .01, 'n') + slider('Queda FM', 'fm.decay', .02, 3, .01, 's', true) : ''}
        ${slider('Vibrato', 'vib', 0, 25, .1, 'n')}
      </div>
    </div>`;
}

(() => {
  const body = $('#sy-body');
  body.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset.path) return;
    const min = +el.dataset.min, max = +el.dataset.max, x = +el.value;
    let v = el.dataset.log ? min * (max / min) ** x : min + (max - min) * x;
    v = Math.round(v / +el.dataset.step) * +el.dataset.step;
    sySet(el.dataset.path, v);
    el.nextElementSibling.textContent = syFmt(el.dataset.fmt, v);
    persistSoon();
  });
  body.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'sy-fm') {
      SY.p.fm = el.checked ? { ratio: 2, index: 2, decay: .6 } : undefined;
      if (!el.checked) delete SY.p.fm;
    } else if (el.dataset.osc !== undefined) {
      const i = +el.dataset.osc;
      if (el.dataset.k === 'type') {
        if (!el.value) {
          if (SY.p.osc.length > 1) SY.p.osc.splice(i, 1);
        } else if (SY.p.osc[i]) SY.p.osc[i].type = el.value;
        else SY.p.osc.push({ type: el.value, gain: .25 });
      } else SY.p.osc[i].ratio = +el.value;
    } else return;
    synthRender();
    persistSoon();
  });
  body.addEventListener('click', e => {
    const b = e.target.closest('.sw');
    if (!b) return;
    SY.p.c = b.dataset.c;
    setPreset(SY.p.id);
    synthRender();
    persistSoon();
  });
})();
let syT;
function persistSoon() {
  // som embutido editado vira uma cópia em "Meus sons"
  if (!SY.p.custom) {
    const copy = JSON.parse(JSON.stringify(SY.p));
    const orig = PRESETS.find(p => p.id === SY.p.id);
    Object.assign(SY.p, JSON.parse(JSON.stringify(SY.base || orig)));
    const base = SY.base || orig;
    Object.assign(copy, { id: 'u' + Date.now().toString(36), name: copy.name !== base.name ? copy.name : base.name + ' (meu)', custom: true, cat: 'Meus sons', icon: 'sparkle' });
    PRESETS.push(copy);
    SY.p = copy;
    $('#sy-name').value = copy.name;
    setPreset(copy.id);
    synthRender();
  }
  clearTimeout(syT);
  syT = setTimeout(persistCustom, 400);
}
$('#sy-name').addEventListener('input', e => {
  SY.p.name = e.target.value.trim() || 'Sem nome';
  persistSoon();
});
$('#sy-name').addEventListener('keydown', e => e.stopPropagation());
$('#sy-del').addEventListener('click', () => {
  if (!SY.p?.custom) return;
  const i = PRESETS.indexOf(SY.p);
  PRESETS.splice(i, 1);
  closeModal('#synth-modal');
  setPreset(PRESETS[0].id);
  persistCustom();
  toast(icon('trash') + 'Som excluído');
});
$('#btn-newsound').addEventListener('click', newSound);
// ao abrir um som embutido no editor, guarda o original para não alterar a fábrica
const _openSynth = openSynth;
openSynth = function (id) {
  const p = PRESETS.find(x => x.id === id);
  SY.base = p && !p.custom ? JSON.parse(JSON.stringify(p)) : null;
  _openSynth(id);
};

// =====================================================================
// trocar o som de cada pad (botão direito no pad, modo Bateria)
// =====================================================================
let pickPad = null;
function openDrumPick(i, anchor) {
  pickPad = i;
  const pop = $('#drum-pick'), groups = ['Bateria', 'Pratos', 'Percussão'];
  $('#dp-title').textContent = `Pad ${i + 1}`;
  $('#dp-list').innerHTML = groups.map(g => `<div class="dp-g">${g}</div>` + DRUM_LIB.filter(d => d.g === g).map(d => `
    <button class="dp-item ${d.id === S.padDrums[i] ? 'on' : ''}" data-id="${d.id}" style="--c:${d.c}"><span class="l-dot"></span>${d.name}</button>`).join('')).join('');
  pop.classList.remove('hidden');
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
  pop.style.left = clamp(r.left, 8, innerWidth - w - 8) + 'px';
  pop.style.top = clamp(r.bottom + 6, 8, innerHeight - h - 8) + 'px';
}
$('#pad-grid').addEventListener('contextmenu', e => {
  const p = e.target.closest('.pad');
  if (!p || S.padMode !== 'drums') return;
  e.preventDefault();
  openDrumPick(+p.dataset.i, p);
});
$('#dp-list').addEventListener('click', e => {
  const b = e.target.closest('.dp-item');
  if (!b) return;
  S.padDrums[pickPad] = b.dataset.id;
  for (const x of document.querySelectorAll('.dp-item')) x.classList.toggle('on', x === b);
  Engine.drum(b.dataset.id, 110, 0, S.kit);
  renderPads();
  save();
  markDirty();
});
$('#dp-reset').addEventListener('click', () => {
  S.padDrums = DRUMS.map(d => d.id);
  $('#drum-pick').classList.add('hidden');
  renderPads();
  save();
  toast(icon('undo') + 'Pads de bateria voltaram ao padrão');
});
document.addEventListener('pointerdown', e => {
  if (!e.target.closest('#drum-pick')) $('#drum-pick').classList.add('hidden');
});

// =====================================================================
// atalhos e início
// =====================================================================
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range' && e.target.type !== 'checkbox') return;
  if (e.target.tagName === 'SELECT' || e.ctrlKey || e.altKey || e.repeat) return;
  if (e.code === 'KeyQ') setArp('on', !S.arp.on);
  if (e.code === 'KeyC') { S.countIn = !S.countIn; renderCount(); save(); toast(icon('metronome') + `Contagem ${S.countIn ? 'ligada' : 'desligada'}`); }
  if (e.code === 'Escape') for (const id of ['#roll-modal', '#seq-modal', '#synth-modal']) closeModal(id);
});

// início (chamado pelo extras.js, que carrega por último)
function studioStart() {
  $('#q-grid').value = S.qGrid;
  boot();
  // tela de carregando sai assim que a interface está montada; os sons gravados chegam em segundo plano
  requestAnimationFrame(() => {
    $('#splash').classList.add('out');
    setTimeout(() => $('#splash').remove(), 350);
  });
  $('#load-pill').classList.remove('hidden');
  Engine.loadSamples(window.api.readSample, p => { $('#load-text').textContent = `Carregando sons ${Math.round(p * 100)}%`; })
    .then(() => { $('#load-pill').classList.add('hidden'); })
    .catch(e => { console.error(e); $('#load-pill').classList.add('hidden'); toast(icon('x') + 'Não consegui carregar os sons gravados'); });
  renderArp();
  renderCount();
  renderScenes();
  restoreAutosave();
}
