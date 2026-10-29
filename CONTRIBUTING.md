# Contribuir

Sugestões e correções são bem-vindas.

- **Bug ou ideia:** abra uma [issue](https://github.com/mateusvpassos/overtone/issues/new/choose) usando o modelo.
- **Falha de segurança:** siga o [SECURITY.md](SECURITY.md), não abra issue pública.

## Pull requests

1. Para mudanças grandes, abra uma issue antes para combinar a ideia.
2. Rode localmente:
   ```bash
   npm install
   node node_modules/electron/install.js
   npm start
   npm test
   ```
   Para não mexer nos seus mixes reais, use uma pasta de dados separada: `set OVERTONE_DATA=C:\temp\overtone-dev` antes do `npm start`.
3. Mantenha o estilo do código (JavaScript simples, sem framework, sem build) e a interface em português.
4. **Sons novos** só entram se forem de domínio público (CC0) ou de licença que permita redistribuir, com a fonte anotada em `renderer/samples/samples.json` e no `THIRD-PARTY-NOTICES.md`.
5. Anote a mudança em `CHANGELOG.md`, na seção **Não lançado**.

Ao enviar um pull request, você concorda que a contribuição é licenciada sob a [licença MIT](LICENSE) do projeto.
