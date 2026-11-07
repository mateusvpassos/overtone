# Overtone

Toca o teclado MIDI sem DAW: sons, pads, knobs, loops, exporta WAV/MP3/MIDI. Público.

Electron (família visual Kino/Strata/Lembreme). Interface em português do Brasil.

## Comandos
```bash
npm start              # roda em dev
npm test               # exportador
npm run dist:dir       # build sem instalador
npm run dist           # instalador NSIS
```

## Regras
- Padrões da família (tela Sobre, licenças, instalação, teste via CDP) estão no CLAUDE.md global.
- Dados de teste isolados: `OVERTONE_DATA=<pasta temporária>`. Nunca mexa nos dados reais do usuário.
- lamejs (LGPL-3.0) fica fora do asar (asarUnpack); samples VCSL/FreePats CC0.
- Release por tag, só com pedido do usuário.

## Fluxo
Ao terminar uma mudança: `npm test` (se houver), conferir a tela, commit + push na `main`. Se o app está instalado, gerar de novo e reinstalar (padrão no CLAUDE.md global).
