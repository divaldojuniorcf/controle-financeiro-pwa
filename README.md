# Controle Financeiro (PWA para iPhone)

App web instalável que reproduz a planilha **Controle Financeiro**: Dashboard com diagnóstico e 7 gráficos,
Contas a Pagar e a Receber com baixa ✔, Pagas e Recebidas, Lançamentos com recorrência mensal,
Investimentos com juros compostos e Parâmetros.

- Funciona offline e abre em tela cheia pelo ícone na Tela de Início.
- **Os dados ficam só no aparelho**, cifrados com o seu PIN. Não há servidor nem conta.
- Uso pessoal, sem App Store e sem conta paga da Apple.

---

## 1. Rodar no computador

Precisa do [Node.js LTS](https://nodejs.org) (versão 20 ou mais nova).

```bash
npm install
npm run dev
```

Abra o endereço que aparecer (normalmente http://localhost:5173).

| Comando | O que faz |
|---|---|
| `npm test` | Roda os testes automáticos (regras da planilha e valores de referência) |
| `npm run dev:iphone` | Servidor acessível pelo iPhone na mesma rede Wi-Fi |
| `npm run build` | Gera a versão de produção na pasta `dist` |
| `npm run preview` | Serve a pasta `dist` para conferir a versão de produção |
| `npm run icones` | Gera de novo os ícones em `public/` |

### Testar no iPhone pela rede de casa (sem publicar)

1. No computador: `npm run dev:iphone`. Se o Windows perguntar, permita o acesso em redes privadas.
2. Veja o endereço "Network" que aparece (ex.: `https://192.168.3.20:5173`). É **https**: o Safari só libera
   a criptografia do PIN em endereços seguros.
3. Abra esse endereço no Safari do iPhone, que precisa estar no mesmo Wi-Fi. Como o certificado é de teste,
   o Safari mostra "Esta conexão não é privada": toque em **Mostrar Detalhes → visitar este site → Visitar Site**.

Por esse endereço de teste o app **não funciona offline**. Para usar de verdade, publique (seção 2).
Se não abrir, o roteador pode estar isolando os aparelhos (comum em redes de visitantes).

### Testes de referência

O arquivo `src/core/__tests__/referencia.test.ts` compara o app com a **seção 10** da especificação usando o
`dados.json` da raiz do projeto, com Hoje = 17/11/2026. Esse teste e o `dados.json` **não vão para o GitHub**,
porque contêm valores das suas finanças. Sem o `dados.json`, o teste é pulado.

---

## 2. Publicar de graça (GitHub Pages, com HTTPS)

Só o **código** é publicado. `dados.json`, a planilha, `especificacao.md` e o teste de referência estão no `.gitignore`.

1. Crie uma conta gratuita em https://github.com.
2. Crie um repositório **público** chamado `controle-financeiro-pwa`, sem README.
3. No computador, na pasta do projeto (troque `SEU-USUARIO`):
   ```bash
   git remote add origin https://github.com/SEU-USUARIO/controle-financeiro-pwa.git
   git push -u origin main
   ```
   Na primeira vez, o Windows abre uma janela para entrar na conta do GitHub.
4. No GitHub, abra o repositório e vá em **Settings → Pages → Build and deployment → Source: GitHub Actions**.
5. Em **Actions**, espere o "Publicar no GitHub Pages" ficar verde (1 a 2 minutos).
   Ele roda os testes antes de publicar.
6. O app fica em `https://SEU-USUARIO.github.io/controle-financeiro-pwa/`.

Cada `git push` publica de novo. O app instalado se atualiza sozinho na próxima vez que abrir com internet.

**Alternativa sem GitHub (Netlify Drop):** rode `npm run build`, entre em https://app.netlify.com/drop
(conta gratuita) e arraste a pasta `dist`. A cada atualização, arraste de novo.

---

## 3. Instalar no iPhone

1. Abra o endereço publicado no **Safari** (precisa ser o Safari).
2. Toque em **Compartilhar** (quadrado com seta) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra o app **pelo ícone** na Tela de Início. Ele abre em tela cheia.
4. Importe os dados **dentro do app instalado**: o app da Tela de Início guarda os dados separados do Safari.
   - Antes, salve o `dados.json` no iCloud Drive (ou envie para você e salve no app Arquivos).
   - Toque em **Importar dados.json** e escolha o arquivo.
5. Crie o **PIN** (4 a 8 números).

O app pede o PIN ao abrir e quando volta depois de 1 minuto em segundo plano.
**Se esquecer o PIN, os dados só voltam por um backup.** Em "Esqueci o PIN", o app apaga os dados para você
importar um backup.

---

## 4. Backup

Os dados existem só no iPhone. Se o app for apagado, eles se perdem. Faça backup.

- **Exportar JSON** (Parâmetros → Backup e dados): abre a folha de compartilhamento. Escolha
  **Salvar em Arquivos** → iCloud Drive. O arquivo se chama `controle-financeiro-AAAA-MM-DD.json`.
- **Aviso automático:** quando passa de 30 dias sem exportar, aparece uma faixa amarela no topo com o botão
  **Exportar JSON**.
- **Restaurar:** Parâmetros → **Importar JSON** e escolha o backup. Também aceita o `dados.json` da planilha.
  Substitui todos os dados.
- **CSV:** botões para Lançamentos, Investimentos, Baixas e Parâmetros (separador `;`, vírgula decimal,
  abre no Excel). **Importar CSV** substitui só a tabela do arquivo.

O arquivo de backup **não é cifrado**: guarde-o em local seguro.

---

## 5. Lembretes de vencimento (notificações)

Às 9h da véspera, uma notificação por dia com os nomes das contas a pagar e a receber que vencem no dia
seguinte, sem valores, mesmo com o app fechado.

- **Ativar:** no iPhone, abra o app **pelo ícone**, vá em Parâmetros → **Ativar lembretes** e permita as notificações.
  Requer iOS 16.4 ou mais novo.
- **Privacidade:** o servidor (`servidor/`, Cloudflare Workers, plano gratuito) guarda só a assinatura de push do
  aparelho e os **horários** dos avisos. Na hora, ele manda um push vazio. O iPhone monta o texto com os nomes
  guardados localmente.
- **Atualização automática:** baixas, edições e recorrências atualizam os lembretes sozinhas quando o app está aberto.

Manutenção do servidor (na pasta `servidor/`):

| Comando | O que faz |
|---|---|
| `npx wrangler login` | Entra na conta do Cloudflare |
| `npx wrangler deploy` | Publica o servidor de novo depois de mudanças |
| `npx wrangler tail` | Mostra os registros do servidor em tempo real |

A chave privada das notificações fica só no Cloudflare (segredo `VAPID_PRIVADA`) e no arquivo local
`servidor/.segredos.json`, fora do Git. Para trocar o par de chaves: `node scripts/gerar-chaves-vapid.mjs --substituir`,
`npx wrangler secret bulk .segredos.json`, atualizar a chave pública em `.env` e `servidor/wrangler.toml` e ativar
os lembretes de novo no iPhone.

---

## 6. Como o app reproduz a planilha

| Planilha | App |
|---|---|
| Fórmulas das abas | `src/core/` (TypeScript puro, sem interface), com testes |
| Macro de baixa (✔) | `src/core/baixas.ts`: grava em Baixas com a data real; marcar de novo desfaz |
| Macro `GerarRecorrentes` | `src/core/recorrencia.ts`: roda ao abrir o app, ao importar e ao mudar Recorrente |
| Chave do item | Igual à da planilha, inclusive a vírgula decimal e os 15 dígitos (`…\|89,9999999999999\|1`), para as baixas importadas continuarem valendo |
| HOJE() em Parâmetros | Data atual do aparelho ou data fixa |
| Listas CatSaida / CatEntrada | As 12 primeiras categorias de saída e as 8 primeiras de entrada, como os intervalos da planilha |

Estrutura:

```
src/core/       regras de negócio (datas, números, itens, contas, baixas, recorrência, investimentos, dashboard, CSV, backup)
src/storage/    IndexedDB, criptografia (PBKDF2 + AES-GCM) e arquivos
src/app/        estado do app, PIN, importação/exportação
src/ui/         telas, componentes e os 7 gráficos (Recharts)
```

---

## 7. Critérios de aceite (seção 9)

| # | Critério | Como foi conferido |
|---|---|---|
| 1 | Cada tela tem as informações e ações da aba | As 7 telas + registro de Baixas (somente leitura), comparadas com a seção 2 |
| 2 | Números batem com a seção 10 | `referencia.test.ts`: os 38 valores, com diferença < 0,000001 |
| 3 | Baixa e desfazer atualizam tudo | `regras.test.ts` + teste no navegador (Contas, Pagas e Recebidas, Baixas, Dashboard) |
| 4 | Recorrência sem duplicar | `regras.test.ts` ("Critério de aceite 4") + teste no navegador mudando Hoje |
| 5 | 7 gráficos com tipos, títulos e dados | Conferidos com os arquivos dos gráficos da planilha; mudam com a Data de análise |
| 6 | Investimentos como na planilha | `referencia.test.ts`: cada coluna calculada das 4 linhas |
| 7 | Diagnóstico e cores | `regras.test.ts`: os três cenários, com as frases |
| 8 | Dados persistem, com backup e exportação | Dados cifrados no IndexedDB (`cripto.test.ts`); exportar e reimportar JSON e CSV sem perda (`csv-backup.test.ts`) |
