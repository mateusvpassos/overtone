# Changelog

Mudanças de cada versão do Overtone. Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); as versões seguem [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [Não lançado]

## [0.9.0] - 2026-10-28

Primeira versão pública.

### Adicionado
- Licença MIT e avisos de terceiros (samples VCSL e FreePats em CC0, lamejs em LGPL 3.0, fontes Geist, ícones Lucide, Electron), incluídos no instalador.
- README com download, privacidade e o aviso do SmartScreen.
- Testes do exportador de WAV e MP3.
- Instalador gerado e publicado automaticamente a cada tag `v*`.

### Alterado
- O lamejs fica fora do pacote `app.asar`, como arquivo comum, para poder ser substituído (exigência da LGPL).

### Corrigido
- Uma sessão salva automaticamente que estiver corrompida é guardada como cópia (`autosave.json.corrompido-<data>`) em vez de ser sobrescrita.

### Segurança
- Electron 44.7.0 → 44.10.0 (correção de certificados intermediários eMudhra comprometidos). Dependências de build atualizadas.
- O app só pede acesso ao MIDI e ao microfone; a câmera e as outras permissões ficam negadas.
- Exportar faixas separadas só grava na pasta escolhida no diálogo.
- A janela não abre links nem navega para fora do app.

## [0.8.1] - 2026-10-23

Versão de uso pessoal, não publicada.

### Adicionado
- Tamanho do teclado da tela (25 a 88 teclas) e altura.

[Não lançado]: https://github.com/mateusvpassos/overtone/compare/v0.9.0...HEAD
[0.9.0]: https://github.com/mateusvpassos/overtone/releases/tag/v0.9.0
