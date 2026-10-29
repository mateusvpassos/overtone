# Segurança

## Versões com correção

Só a versão mais recente recebe correções de segurança.

## Como reportar

**Não abra uma issue pública.** Use o reporte privado do GitHub: aba **Security → Report a vulnerability** ([link direto](https://github.com/mateusvpassos/overtone/security/advisories/new)).

Inclua a versão do Overtone e do Windows, os passos para reproduzir e o impacto. A resposta inicial vem em até 7 dias.

## Escopo

O Overtone roda só no seu computador e não acessa a rede. Interessam principalmente:
- execução de código ou escrita de arquivos fora das pastas do app a partir de um mix (`.json`) ou de um arquivo `.mid` aberto no modo Aprender;
- uso do microfone ou do MIDI sem você pedir;
- problemas no instalador.
