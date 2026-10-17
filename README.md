# Overtone

Toca o teclado MIDI (feito pro AMW Master25 / "MIDI KeyBoard 25A") sem abrir DAW. Electron + Web MIDI + WebAudio, sem samples. Mesma família visual do Kino, Strata e Lembreme.

## Recursos
- **27 sons** em 6 grupos:
  - Teclas: **piano de cauda gravado** (Steinway, 2 camadas de força), piano de armário, cravo, órgão de tubos, piano elétrico, órgão, clavinet
  - Gravados: violão nylon, baixo elétrico, vibrafone, harpa de concerto, sax tenor
  - Synth: lead, supersaw, pad, pluck, 8-bit
  - Baixo: baixo, acid (303), sub 808
  - Orquestra: cordas, metais, flauta, harpa
  - Percussivo: sino, marimba, kalimba

  O Program Change do teclado troca o som.
- **8 knobs:** volume, filtro, ressonância, ataque, release, reverb, delay (sincronizado ao BPM) e volume da bateria
- **8 pads, 3 modos:**
  - **Bateria:** bumbo, caixa, chimbal, chimbal aberto, palmas, tom, cowbell, prato. Quatro kits: **Acústico** (bateria gravada), Eletrônico, 808 e Lo-fi (a acústica saturada). O **botão direito num pad** troca o som dele por qualquer um dos 23 da biblioteca: bateria (tom grave, aro, caixa fraca, chimbal no pé), pratos (condução, cúpula) e percussão (shaker, pandeirola, conga, bongô, cajón, claves, bloco, triângulo).
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
- **Exportar:**
  - **Mix** em WAV 16-bit ou MP3 192 kbps: toca 1, 2, 4 ou 8 voltas gravando a saída em tempo real, com a cauda do reverb opcional.
  - **Faixas separadas:** grava cada faixa sozinha, uma de cada vez, numa pasta.
  - **MIDI (.mid):** sai na hora, com a bateria no canal 10 (General MIDI), pra abrir no FL Studio.
- **Contagem** (`1, 2, 3, 4` ou `C`): um compasso de metrônomo antes de gravar.
- **Quantizar:** encaixa as notas da faixa selecionada (ou do trecho selecionado) na grade de 1/4 a 1/32. Com `Shift`, encaixa só 50%.
- **Arpejador** (`Q`): segure um acorde e ele toca as notas em sequência no BPM.
  - Ordens: sobe, desce, sobe e desce, aleatório ou como tocou.
  - Velocidade de 1/4 a 1/32 e 1 a 3 oitavas.
  - **Trava** continua tocando depois de soltar.
  - O que ele toca é gravado no loop.
- **Cenas A–H:** guardam quais faixas tocam e os volumes. Clique troca a cena na próxima volta do loop, `Shift` grava por cima e `Alt` apaga. O modo **Cenas** dos pads troca pelas pads.
- **Faixa** (botão de sliders): pan, quanto de reverb/delay a faixa recebe, cor e atalhos para os editores.
- **Passos:** bateria em grade (16 passos por compasso) na faixa selecionada. Clique ou arraste para ligar, e `Shift` dá acento. Sem loop ainda, ele cria um compasso.
- **Notas** (piano-roll):
  - Clique no vazio cria uma nota.
  - Arrastar move, e a borda direita muda a duração.
  - Duplo clique ou `Delete` apaga.
  - A roda do mouse muda a força, e `Alt` solta da grade.
- **Meus sons** (**+ Som** ou o lápis): editor com 3 osciladores, filtro com envelope, ADSR, FM e vibrato. Vale na hora e fica salvo. Editar um som de fábrica cria uma cópia sua.
- **Salvamento automático:** ao abrir, o app volta com a sessão como estava (faixas, cenas e sons), mesmo sem ter salvo o mix.
- **Abrir rápido:** a janela aparece na hora com uma tela de carregando, e os sons gravados carregam em segundo plano (o indicador fica na barra de título).
- **Ajustes** (engrenagem):
  - **Toque:** suave, normal, firme ou força fixa.
  - **Metrônomo:** semínimas, colcheias, tercinas ou semicolcheias.
  - **Swing:** vale no quantizar e no arpejador.
  - **MIDI clock:** segue o BPM/play/stop de outro app ou envia o nosso.
- **Escala travada** (acima do teclado da tela): com maior, menor, pentatônicas, blues, dórico ou mixolídio, toda tecla vira uma nota da escala. As teclas fora da escala ficam apagadas.
- **Efeitos por faixa** (botão de sliders): EQ de 3 bandas, drive, chorus e compressor, além de pan e envio de reverb/delay.
- **Microfone numa faixa:** arme pelo botão de sliders da faixa. Ele grava a próxima volta inteira do loop, compensa a latência e mostra o nível. O áudio fica em `%APPDATA%\Overtone\audio`.
- **Refazer** (`Ctrl+Y`) e **versões**: cada vez que você salva por cima, a versão anterior fica guardada (até 25). Ela aparece no botão de relógio da lista de mixes.
- **Modo show** (`F11`): tela cheia com play grande, progresso do loop, cenas grandes, mudo das faixas, BPM e batida do metrônomo.
- **Aprender:**
  - **Música:** abra um `.mid`, escolha as trilhas e toque.
  - **Acordes:** acordes aleatórios no tom dos pads.
  - **Escala:** a escala do tom, subindo e descendo.

  Ele espera você acertar, acende as teclas certas no teclado da tela, conta acertos/erros e tem **Ouvir** para escutar o trecho.
- **Mod wheel** = vibrato · **Pitch bend** = ±2 semitons · **CC64** = sustain · **CC7** = volume
- Teclado na tela (clique/arraste), detecção de acorde, osciloscópio e monitor do último sinal MIDI

## Mapeamento
- Os knobs já vêm ligados ao CC70–CC77 (canal 1), na ordem do Master25: o 1º knob é Volume, o 2º é Filtro, e assim por diante. Pads no canal 10 se ligam sozinhos ao bater.
- **Configurar controles:** é um assistente que pede para girar cada knob e bater em cada pad, na ordem. Use se a ordem estiver errada. **Pular** passa para o próximo controle, e `Esc` cancela.
- **Mapear:** clique num knob/pad da tela e gire/aperte o controle, para trocar só um. `Esc` sai.
- **Padrão** (no painel de knobs) volta os valores dos knobs. **Resetar mapeamento** volta as ligações para o padrão.

## Atalhos (teclado do PC)
`A`–`Ç` notas · `Z`/`X` oitava · `1`–`8` pads · `↑`/`↓` som · `R` grava no loop selecionado · `←`/`→` escolhe o loop · `Enter` toca/para · `M` metrônomo · `Q` arpejador · `C` contagem · `Espaço` parar tudo · arrastar knob com `Shift` = ajuste fino · duplo clique = padrão

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

## Créditos
Piano, vibrafone, harpa, sax, bateria e percussão: [VCSL — Versilian Community Sample Library](https://github.com/sgossner/VCSL). Violão nylon e baixo elétrico: [FreePats](https://freepats.zenvoid.org/). Tudo em domínio público (CC0 1.0). Foram convertidos para OGG e encurtados por `renderer/samples/samples.json`.
