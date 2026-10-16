# Overtone

Toca o teclado MIDI (feito pro AMW Master25 / "MIDI KeyBoard 25A") sem abrir DAW. Electron + Web MIDI + WebAudio, sem samples. Mesma família visual do Kino, Strata e Lembreme.

## Recursos
- **18 sons sintetizados** em 5 grupos:
  - Teclas: piano elétrico, órgão, clavinet
  - Synth: lead, supersaw, pad, pluck, 8-bit
  - Baixo: baixo, acid (303), sub 808
  - Orquestra: cordas, metais, flauta, harpa
  - Percussivo: sino, marimba, kalimba

  O Program Change do teclado troca o som.
- **8 knobs:** volume, filtro, ressonância, ataque, release, reverb, delay (sincronizado ao BPM) e volume da bateria
- **8 pads, 3 modos:**
  - **Bateria:** bumbo, caixa, chimbal, chimbal aberto, palmas, tom, cowbell, prato. Três kits: Acústico, 808 e Lo-fi.
  - **Acordes:** I–vii° + I oitava acima no tom e escala escolhidos (maior/menor). O acorde segura enquanto o pad está apertado.
  - **Funções:** oitava −/+, som anterior/próximo, sustain, gravar loop, próximo loop, tocar/parar
- **Loops em faixas (até 12):** o `R` (ou a bolinha da faixa) arma a gravação, e o primeiro loop só começa a contar na primeira nota ou pad. O primeiro loop gravado define o tamanho, e os outros gravam no mesmo tamanho; gravar numa faixa com notas sobrepõe. Cada faixa tem mudo, apagar e um mini piano-roll. Com o metrônomo ligado, o tamanho arredonda para compassos. Cada nota guarda o som/kit com que foi gravada.
- **Faixas:** **+ Faixa** adiciona e o **×** remove (`Ctrl+Z` desfaz). Cada faixa tem volume próprio, e duplo clique no nome renomeia. A borracha esvazia a faixa.
- **Mixes:** `Ctrl+S` salva (na primeira vez pede o nome). O botão com o nome do mix abre a lista para abrir, excluir (vai pra Lixeira) ou começar um novo. Um mix guarda as faixas, os volumes, o BPM, o som, o kit e os knobs. Ficam em `%APPDATA%\Overtone\mixes\*.json`, e **Abrir pasta** mostra onde.
- **Editar loops:** arraste numa faixa para selecionar um trecho.
  - **Manter só o trecho:** o trecho vira o loop inteiro, em todas as faixas.
  - **Apagar trecho** (`Delete`): tira as notas do trecho só daquela faixa.
  - **Desfazer** (`Ctrl+Z`): volta as edições, em vários níveis.
  - `Esc` limpa a seleção.
- **Exportar WAV/MP3:** toca o mix 1, 2, 4 ou 8 voltas gravando a saída em tempo real, com a cauda do reverb opcional. Depois pede onde salvar (pasta Músicas por padrão). Tem WAV 16-bit e MP3 192 kbps (lamejs).
- **Mod wheel** = vibrato · **Pitch bend** = ±2 semitons · **CC64** = sustain · **CC7** = volume
- Teclado na tela (clique/arraste), detecção de acorde, osciloscópio e monitor do último sinal MIDI

## Mapeamento
- Os knobs já vêm ligados ao CC70–CC77 (canal 1), na ordem do Master25: o 1º knob é Volume, o 2º é Filtro, e assim por diante. Pads no canal 10 se ligam sozinhos ao bater.
- **Configurar controles:** é um assistente que pede para girar cada knob e bater em cada pad, na ordem. Use se a ordem estiver errada. **Pular** passa para o próximo controle, e `Esc` cancela.
- **Mapear:** clique num knob/pad da tela e gire/aperte o controle, para trocar só um. `Esc` sai.
- **Padrão** (no painel de knobs) volta os valores dos knobs. **Resetar mapeamento** volta as ligações para o padrão.

## Atalhos (teclado do PC)
`A`–`Ç` notas · `Z`/`X` oitava · `1`–`8` pads · `↑`/`↓` som · `R` grava no loop selecionado · `←`/`→` escolhe o loop · `Enter` toca/para · `M` metrônomo · `Espaço` parar tudo · arrastar knob com `Shift` = ajuste fino · duplo clique = padrão

## Rodar
```bash
npm install
npm start
```
Se o `npm install` não baixar o Electron (scripts de instalação bloqueados), rode `node node_modules/electron/install.js`.

## Gerar instalador
```bash
npm run dist
```
Saída em `dist/Overtone-Setup-<versão>.exe`. Ícone: `assets/icon.svg` → `npm run icon` gera `renderer/icon.png`. Preferências salvas no localStorage do app (`%APPDATA%\Overtone`).
