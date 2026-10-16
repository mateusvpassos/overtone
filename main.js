const { app, BrowserWindow, session } = require('electron');
const path = require('path');

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
    webPreferences: { backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
}

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
