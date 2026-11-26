# Conector do Claude · Command Center do Sea Rooftop

Com este conector, você conversa com o Claude (no computador ou no celular) e ele consulta e altera os dados do Command Center: equipe, eventos, diárias, reembolsos, rotina, checklist, cotações, agenda e mais. O PC não precisa ficar ligado e o navegador não precisa estar aberto.

## Como funciona (resumo)

- O conector fica **dentro do próprio site no Netlify** (uma "Netlify Function"). É publicado junto com o app, a cada push na `main`.
- Para conectar, o Claude abre uma página do próprio Command Center, você entra com **o seu login de sempre** e toca em **Autorizar**.
- O conector acessa o Firestore **como você**: as regras de segurança (`firestore.rules`) continuam valendo e tudo o que ele grava fica com o seu e-mail em `createdBy` (e `criadoVia: "Claude"`).
- **Apenas admin** consegue conectar. Dá para restringir ainda mais a uma lista de e-mails (recomendado: só o seu).
- Não precisa de conta de serviço nem de chave do Google. O único segredo é uma chave aleatória guardada no Netlify (nunca no GitHub).

### Por que esta opção

| Opção | Custo | Trabalho para você | Segurança |
|---|---|---|---|
| **Netlify Function + seu login (escolhida)** | R$ 0 | Criar 1 variável no Netlify | Regras do Firestore valem; só admin; nada de chave do Google |
| Netlify Function + conta de serviço (Firebase Admin) | R$ 0 | Criar conta de serviço, baixar chave JSON, colar no Netlify | A chave ignora as regras do Firestore; se vazar, abre tudo |
| Cloud Run | R$ 0 a poucos reais | Configurar projeto, faturamento, deploy separado | Igual à anterior, com mais peças para manter |

### Custos

- **Netlify:** o conector usa poucas chamadas de função por conversa. Cabe com folga no plano gratuito.
- **Firestore:** cada consulta lê alguns documentos. Cabe na cota gratuita diária (50 mil leituras).
- **Claude:** conectores personalizados exigem plano pago do Claude (Pro, Max, Team ou Enterprise).

## Passo a passo

### 1. Gerar a chave secreta (no seu PC)

Abra o PowerShell e rode o comando abaixo. Ele gera uma chave aleatória e **copia para a área de transferência**. Não precisa ver nem anotar a chave.

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) | Set-Clipboard
```

### 2. Cadastrar as variáveis no Netlify

1. Entre em [app.netlify.com](https://app.netlify.com) e abra o site do Command Center.
2. Vá em **Site configuration → Environment variables → Add a variable → Add a single variable**.
3. Crie a primeira:
   - **Key:** `MCP_SECRET`
   - **Value:** cole (Ctrl+V) a chave do passo 1
   - Marque **Contains secret values** e salve.
4. Crie a segunda:
   - **Key:** `MCP_ALLOWED_EMAILS`
   - **Value:** o seu e-mail de login do Command Center (para mais de um, separe por vírgula)
   - Salve.

### 3. Publicar

Depois que o código do conector estiver na `main` (o Claude faz o commit e o push quando você autorizar), o Netlify publica sozinho. Se você criou as variáveis **depois** da última publicação, vá em **Deploys → Trigger deploy → Deploy site** para elas valerem.

Para conferir, abra no navegador (troque pelo endereço do seu site):

`https://SEU-SITE.netlify.app/.well-known/oauth-authorization-server`

Deve aparecer um texto que começa com `{"issuer":`. Se aparecer `MCP_SECRET não configurado`, revise o passo 2 e publique de novo.

### 4. Adicionar o conector no Claude

Faça isto uma vez, no computador (Claude Desktop) ou em [claude.ai](https://claude.ai). Depois ele aparece sozinho no app do celular.

1. Abra **Configurações → Conectores** (em inglês: *Settings → Connectors*).
2. Clique em **Adicionar conector personalizado** (*Add custom connector*).
3. Preencha:
   - **Nome:** `Sea Rooftop`
   - **URL:** `https://SEU-SITE.netlify.app/mcp`
4. Clique em **Adicionar** e depois em **Conectar**.
5. Abre a página **"Conectar o Claude · Sea Rooftop"**. Se você já estiver logado no Command Center naquele navegador, ela mostra o seu e-mail. Se não, entre com o seu e-mail e senha.
6. Toque em **Autorizar**. Pronto.

### 5. Usar

- Em uma conversa nova, toque no **+** (ou no ícone de ferramentas) e confira se **Sea Rooftop** está ligado.
- No celular: o conector aparece no mesmo menu. Se pedir, toque em **Conectar** de novo e autorize.
- Exemplos de pedidos:
  - "O que tenho para hoje no Command Center?"
  - "Lança uma diária de hoje para a Ana, garçonete, R$ 110, motivo: evento."
  - "Cria um evento corporativo para 40 pessoas no dia 20/12, casa fechada."
  - "Marca como feita a tarefa do contrato no evento da Empresa X."
  - "Quais reembolsos ainda não foram enviados ao financeiro?"
- Antes de apagar qualquer coisa, o Claude pede confirmação.

## O que o conector faz

| Ferramenta | Para quê |
|---|---|
| `resumo_do_dia` | Rotina pendente, tarefas de eventos, eventos, atrações, diárias, checklist, ocorrências e reparos do dia |
| `listar_registros` / `obter_registro` | Consultar qualquer coleção, com filtros, período e busca |
| `criar_registro` / `atualizar_registro` / `apagar_registro` | Criar, alterar e apagar, no mesmo formato que o app grava |
| `evento_marcar_tarefa` / `evento_adicionar_tarefa` | Checklist do Planejador de Eventos |
| `rotina_marcar` | Marcar tarefa da rotina (Meu Dia) como feita |
| `listar_colecoes` | Ver coleções e campos aceitos |

Coleções com leitura e escrita: `equipe`, `eventos`, `extras_semana`, `reembolsos`, `rotina_tarefas`, `checklist_gerencial`, `fornecedores`, `produtos_compra`, `cotacoes`, `agenda_eventos`, `ocorrencias`, `manutencao_reparos`, `contatos`.
Só leitura: `rotina_execucoes` (gravada por `rotina_marcar`), `requisicoes`, `briefings`.
Fora do conector: `user_roles` (cargos) e as fotos de comprovantes.

## Segurança

- **Desconectar na hora (botão de pânico):** troque o valor de `MCP_SECRET` no Netlify (passo 1 e 2 de novo) e faça um novo deploy. Todos os acessos do Claude param de funcionar.
- **Trocar a senha** do Command Center também derruba o acesso do Claude. Basta conectar de novo depois.
- Tirar o cargo de admin de alguém bloqueia essa pessoa no conector em até 5 minutos.
- O login dura 90 dias sem uso. Depois disso o Claude pede para conectar de novo.
- A página de login só devolve o acesso para o Claude (claude.ai / claude.com) ou para o próprio computador (testes).

## Para quem mantém o código

- Código: `netlify/functions/mcp.mts` (entrada) e `netlify/mcp/` (lógica). Os formatos das coleções ficam em `netlify/mcp/colecoes.ts`. Ao mudar um módulo do app, atualize ali também.
- O checklist de eventos e a rotina reutilizam `src/eventosUtils.ts` e `src/rotinaUtils.ts`.
- Teste local: rode o app (`npm run dev`) e, em outro terminal, `npx tsx scripts/mcp-dev.ts` com `MCP_SECRET` definido. O Vite encaminha `/mcp`, `/oauth` e `/.well-known` para a porta 8788.
- Fuso usado nas datas do dia: `America/Fortaleza` (mesmo horário de João Pessoa).
