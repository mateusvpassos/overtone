const { app, BrowserWindow, session, ipcMain, shell, dialog } = require('electron');
const { writeAudio } = require('./exporter');
const path = require('path');
const fs = require('fs');

app.setName('Overtone');
app.setAppUserModelId('com.mateusvpassos.overtone');
// desenvolvimento/testes: pasta de dados separada
if (process.env.OVERTONE_DATA) app.setPath('userData', process.env.OVERTONE_DATA);
// latência baixa: não deixa o Chromium economizar no áudio/timers com a janela em segundo plano
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

if (!app.requestSingleInstanceLock()) app.quit();

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 900, minWidth: 1100, minHeight: 760,
    title: 'Overtone', icon: path.join(__dirname, 'renderer', 'icon.png'), show: true,
    backgroundColor: '#0d0e13',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0d0e13', symbolColor: '#8b90a4', height: 40 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ---------- mixes: um .json por mix em %APPDATA%\Overtone\mixes ----------
const mixDir = () => {
  const d = path.join(app.getPath('userData'), 'mixes');
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const slug = name => name.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'mix';
const inDir = file => {
  const f = path.join(mixDir(), path.basename(file));
  if (!f.endsWith('.json')) throw new Error('arquivo inválido');
  return f;
};

ipcMain.handle('mix:list', () => fs.readdirSync(mixDir())
  .filter(f => f.endsWith('.json'))
  .map(f => {
    try {
      const d = JSON.parse(fs.readFileSync(path.join(mixDir(), f), 'utf8'));
      return { file: f, name: d.name || f, saved: d.saved, len: d.len, bpm: d.bpm, tracks: (d.tracks || []).filter(t => t.events?.length).length };
    } catch { return null; }
  })
  .filter(Boolean)
  .sort((a, b) => (b.saved || '').localeCompare(a.saved || '')));

// versões: guarda o arquivo anterior antes de salvar por cima (até 25 por mix)
const verDir = file => path.join(mixDir(), '.versoes', path.basename(file, '.json'));
ipcMain.handle('mix:versions', (_, file) => {
  const d = verDir(file);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.json')).sort().reverse().map(f => {
    try {
      const j = JSON.parse(fs.readFileSync(path.join(d, f), 'utf8'));
      return { id: f, saved: j.saved, len: j.len, tracks: (j.tracks || []).filter(t => t.events?.length || t.audioFile).length };
    } catch { return null; }
  }).filter(Boolean);
});
ipcMain.handle('mix:version-load', (_, file, id) => JSON.parse(fs.readFileSync(path.join(verDir(file), path.basename(id)), 'utf8')));

ipcMain.handle('mix:save', (_, name, data) => {
  const file = slug(name) + '.json';
  const f = path.join(mixDir(), file);
  if (fs.existsSync(f)) {
    const d = verDir(file);
    fs.mkdirSync(d, { recursive: true });
    fs.copyFileSync(f, path.join(d, new Date().toISOString().replace(/[:.]/g, '-') + '.json'));
    const old = fs.readdirSync(d).filter(x => x.endsWith('.json')).sort();
    for (const x of old.slice(0, Math.max(0, old.length - 25))) fs.rmSync(path.join(d, x));
  }
  fs.writeFileSync(f + '.tmp', JSON.stringify({ ...data, name, saved: new Date().toISOString() }));
  fs.renameSync(f + '.tmp', f);
  return file;
});
ipcMain.handle('mix:load', (_, file) => JSON.parse(fs.readFileSync(inDir(file), 'utf8')));
// excluir manda pra Lixeira (dá pra recuperar)
ipcMain.handle('mix:delete', (_, file) => shell.trashItem(inDir(file)));
ipcMain.handle('mix:folder', () => shell.openPath(mixDir()));

// ---------- exportar WAV/MP3 ----------
ipcMain.handle('export:audio', async (_, name, format, rate, left, right) => {
  const ext = format === 'mp3' ? 'mp3' : 'wav';
  const r = await dialog.showSaveDialog(win, {
    title: 'Exportar mix',
    defaultPath: path.join(app.getPath('music'), `${slug(name || 'overtone')}.${ext}`),
    filters: [ext === 'mp3' ? { name: 'MP3', extensions: ['mp3'] } : { name: 'WAV', extensions: ['wav'] }]
  });
  if (r.canceled || !r.filePath) return null;
  const bytes = writeAudio(r.filePath, left, right, rate);
  return { file: r.filePath, bytes };
});
ipcMain.handle('export:reveal', (_, file) => shell.showItemInFolder(file));
// só grava faixas na pasta que o usuário escolheu no diálogo
let pickedDir = null;
ipcMain.handle('export:pick-folder', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Pasta para as faixas', defaultPath: app.getPath('music'), properties: ['openDirectory', 'createDirectory'] });
  pickedDir = r.canceled ? null : r.filePaths[0];
  return pickedDir;
});
// nome de arquivo seguro no Windows (as faixas podem ter qualquer nome)
const safeName = n => n.replace(/[<>:"/\\|?*\p{Cc}]+/gu, '').trim().slice(0, 120) || 'faixa';
ipcMain.handle('export:audio-to', (_, dir, name, format, rate, left, right) => {
  if (!pickedDir || path.resolve(dir) !== path.resolve(pickedDir)) throw new Error('pasta não escolhida');
  const file = path.join(dir, `${safeName(name)}.${format === 'mp3' ? 'mp3' : 'wav'}`);
  writeAudio(file, left, right, rate);
  return file;
});
ipcMain.handle('export:file', async (_, name, ext, bytes) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Salvar', defaultPath: path.join(app.getPath('music'), safeName(name)),
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }]
  });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, Buffer.from(bytes));
  return { file: r.filePath, bytes: bytes.length };
});

// ---------- samples empacotados (renderer/samples) ----------
const sampleDir = path.join(__dirname, 'renderer', 'samples');
ipcMain.handle('sample:read', (_, file) => {
  const f = path.resolve(sampleDir, file);
  if (!f.startsWith(sampleDir + path.sep)) throw new Error('caminho inválido');
  return fs.readFileSync(f);
});

// ---------- áudio gravado do microfone (%APPDATA%\Overtone\audio) ----------
const audioDir = () => { const d = path.join(app.getPath('userData'), 'audio'); fs.mkdirSync(d, { recursive: true }); return d; };
ipcMain.handle('audio:save', (_, rate, left, right) => {
  const name = `mic-${Date.now().toString(36)}.wav`;
  writeAudio(path.join(audioDir(), name), left, right, rate);
  return name;
});
ipcMain.handle('audio:read', (_, name) => fs.readFileSync(path.join(audioDir(), path.basename(name))));

// ---------- modo aprender e modo show ----------
ipcMain.handle('learn:open-mid', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Abrir música MIDI', filters: [{ name: 'MIDI', extensions: ['mid', 'midi'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  return { name: path.basename(r.filePaths[0]), bytes: fs.readFileSync(r.filePaths[0]) };
});
ipcMain.handle('win:fullscreen', (_, on) => win.setFullScreen(!!on));

// ---------- sobre ----------
const REPO = 'https://github.com/mateusvpassos/overtone';
// instalado, LICENSE e avisos ficam em resources/ (extraResources); rodando do código, na raiz
const resFile = (packaged, dev) => app.isPackaged ? path.join(process.resourcesPath, packaged) : path.join(__dirname, dev);
ipcMain.handle('app:about', () => ({ version: app.getVersion() }));
ipcMain.handle('app:notices', () => [resFile('LICENSE.txt', 'LICENSE'), resFile('THIRD-PARTY-NOTICES.md', 'THIRD-PARTY-NOTICES.md')]
  .map(f => { try { return fs.readFileSync(f, 'utf8'); } catch { return ''; } })
  .join('\n\n' + '─'.repeat(60) + '\n\n'));
ipcMain.handle('app:open', (_, which) => {
  if (which === 'licenses') return shell.openPath(resFile('licenses', 'licenses'));
  const url = { repo: REPO, issues: REPO + '/issues/new/choose' }[which];
  if (url) shell.openExternal(url);
});

// ---------- salvamento automático da sessão ----------
const autoFile = () => path.join(app.getPath('userData'), 'autosave.json');
ipcMain.on('auto:save', (_, data) => {
  try {
    fs.writeFileSync(autoFile() + '.tmp', JSON.stringify(data));
    fs.renameSync(autoFile() + '.tmp', autoFile());
  } catch {}
});
ipcMain.handle('auto:load', () => {
  if (!fs.existsSync(autoFile())) return null;
  try {
    return JSON.parse(fs.readFileSync(autoFile(), 'utf8'));
  } catch {
    // sessão corrompida: guarda uma cópia antes do próximo salvamento automático sobrescrever
    try { fs.copyFileSync(autoFile(), autoFile() + '.corrompido-' + Date.now()); } catch {}
    return null;
  }
});

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  // Web MIDI e microfone precisam de permissão; câmera e o resto ficam negados
  const allow = (p, d) => p === 'midi' || p === 'midiSysex'
    || (p === 'media' && !(d?.mediaTypes || []).includes('video') && d?.mediaType !== 'video');
  session.defaultSession.setPermissionRequestHandler((_, p, cb, d) => cb(allow(p, d)));
  session.defaultSession.setPermissionCheckHandler((_, p, __, d) => allow(p, d));
  createWindow();
  // nada de abrir links ou navegar para fora do app
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
});

app.on('window-all-closed', () => app.quit());
