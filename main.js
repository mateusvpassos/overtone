const { app, BrowserWindow, session, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('Overtone');
app.setAppUserModelId('com.mateusvpassos.overtone');
// latência baixa: não deixa o Chromium economizar no áudio/timers com a janela em segundo plano
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

if (!app.requestSingleInstanceLock()) app.quit();

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 900, minWidth: 1100, minHeight: 760,
    title: 'Overtone', icon: path.join(__dirname, 'renderer', 'icon.png'), show: false,
    backgroundColor: '#0d0e13',
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0d0e13', symbolColor: '#8b90a4', height: 40 },
    webPreferences: { preload: path.join(__dirname, 'preload.js'), backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
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

ipcMain.handle('mix:save', (_, name, data) => {
  const file = slug(name) + '.json';
  const f = path.join(mixDir(), file);
  fs.writeFileSync(f + '.tmp', JSON.stringify({ ...data, name, saved: new Date().toISOString() }));
  fs.renameSync(f + '.tmp', f);
  return file;
});
ipcMain.handle('mix:load', (_, file) => JSON.parse(fs.readFileSync(inDir(file), 'utf8')));
// excluir manda pra Lixeira (dá pra recuperar)
ipcMain.handle('mix:delete', (_, file) => shell.trashItem(inDir(file)));
ipcMain.handle('mix:folder', () => shell.openPath(mixDir()));

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  // Web MIDI precisa de permissão; só a página local pede
  const allow = p => p === 'midi' || p === 'midiSysex';
  session.defaultSession.setPermissionRequestHandler((_, p, cb) => cb(allow(p)));
  session.defaultSession.setPermissionCheckHandler((_, p) => allow(p));
  createWindow();
});

app.on('window-all-closed', () => app.quit());
