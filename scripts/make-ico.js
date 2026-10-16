// Gera assets/icon.ico (PNG 256x256 dentro do ICO) a partir de renderer/icon.png, para o atalho do Windows.
// Uso: npx electron scripts/make-ico.js
const { app, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(() => {
  const png = nativeImage.createFromPath(path.join(__dirname, '..', 'renderer', 'icon.png')).resize({ width: 256, height: 256, quality: 'best' }).toPNG();
  const h = Buffer.alloc(22);
  h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4); // tipo ícone, 1 imagem
  h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12); // planos, bpp (largura/altura 0 = 256)
  h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
  fs.writeFileSync(path.join(__dirname, '..', 'assets', 'icon.ico'), Buffer.concat([h, png]));
  console.log('assets/icon.ico gerado');
  app.quit();
});
