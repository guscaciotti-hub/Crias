# AtendêAI — Handoff para Parte 2

> Documento de continuidade do projeto. Leia isto primeiro ao iniciar uma nova sessão.
> Última atualização: 2026-05-29
>
> **Repositório dedicado**: https://github.com/guscaciotti-hub/atendeai (privado)
> O código foi migrado do repositório antigo `express-js-on-vercel` para cá.

---

## O que é o AtendêAI

SaaS de chatbot para WhatsApp voltado a negócios locais (clínicas, restaurantes,
agências, imobiliárias). Dois modos de bot:
- **Agentes IA** — atendentes que respondem com IA (OpenAI GPT-4o-mini)
- **Fluxos** — árvores de menus/botões para fluxos determinísticos

---

## Stack

- **Monorepo pnpm**: `client/` (React+Vite+tRPC), `server/` (Express+tRPC v11),
  `shared/`, `drizzle/` (schema)
- **DB**: SQLite + Drizzle ORM. Migrations via `ALTER TABLE` try/catch em `server/db.ts`
- **WhatsApp**: Baileys `7.0.0-rc13` com `makeCacheableSignalKeyStore`
- **IA**: OpenAI (GPT-4o-mini para chat, Whisper para transcrição de áudio)
- **Auth**: tRPC protectedProcedure, sessões, verificação de email (nodemailer SMTP)
- **Process**: PM2

---

## Infra / Deploy

- **VPS**: `ssh root@72.62.232.128` (senha já trocada pelo usuário — pedir se necessário)
- **App roda em**: `/root/atendeai/app` (é aqui que está o git, NÃO em `/root/atendeai`)
- **Dados persistentes**: `/root/atendeai/data/` (db, sessions, .env)
- **.env persistente**: `/root/atendeai/data/.env` — NUNCA é sobrescrito por deploy.
  Contém OPENAI_API_KEY, SMTP, DB_PATH, SESSIONS_DIR
- **Site**: http://72.62.232.128:3001
- **Admin**: guscaciotti@gmail.com

### Repositório (novo — migrado em 2026-05-29)
```
https://github.com/guscaciotti-hub/atendeai
```

### Comando de deploy (sempre)
```bash
cd /root/atendeai/app && git pull origin claude/peaceful-darwin-RUNJD && pnpm build && pm2 restart atendeai
```

### Branch de trabalho
`claude/peaceful-darwin-RUNJD` — desenvolver, commitar e pushar SEMPRE nela.

---

## ⚠️ Segurança (recorrente)

- A **OPENAI_API_KEY já vazou várias vezes** em screenshots. Sempre avisar o usuário
  para revogar/regenerar se aparecer. A chave vive só em `/root/atendeai/data/.env`.
- Nunca commitar chaves.

---

## Funcionalidades já implementadas (Parte 1)

1. **Email verification + forgot password** (nodemailer, códigos de 6 dígitos)
2. **Criação de agente**: "Assistente de Criação" (IA gera) vs "Controle Total" (manual)
3. **Separação Agentes IA / Fluxos** em seções e páginas distintas no sidebar
4. **Humanização anti-bloqueio**:
   - Delay antes dos ticks azuis (2-5s aleatório, `WA_READ_DELAY_MIN/MAX`)
   - Presença "digitando…" + delay proporcional ao tamanho + jitter
   - Tempo de Resposta por agente (4-30s, default 4s)
5. **Batching de mensagens** (`message-bridge.ts`): junta mensagens enviadas em
   rajada (debounce 4s, `WA_BATCH_WINDOW_MS`) e responde uma vez com contexto
6. **Transcrição de áudio** via OpenAI Whisper (`baileys-manager.ts` → `transcribeAudio`)
7. **handoffCondition**: regra em linguagem natural de quando transferir p/ humano
8. **Anti-contaminação de contexto**: ao salvar prompt/descrição, fecha conversas
   ativas e deleta FAQ chunks de templates antigos
9. **Delete de agente em cascata** (FK-safe)
10. **Operador + Reativação automática**:
    - Operador manda mensagem no inbox → bot pausa (status=handoff)
    - Timer (60s) reativa após X min de inatividade com mensagem predefinida
    - Config por agente: `reactivationEnabled/Message/TimeoutMin`
    - Mutations: `conversations.sendHumanMessage`, `conversations.humanTakeover`
    - Arquivo: `server/whatsapp/reactivation-timer.ts`

---

## Arquivos-chave

| Arquivo | Responsabilidade |
|---|---|
| `server/whatsapp/baileys-manager.ts` | Conexão WA, QR/pairing, humanização de envio, transcrição áudio |
| `server/whatsapp/message-bridge.ts` | Roteamento de mensagens, batching, handoff, cache de conversa |
| `server/whatsapp/ai-agent.ts` | Chamada OpenAI, monta system prompt, knowledge, handoff |
| `server/whatsapp/reactivation-timer.ts` | Timer de reativação pós-handoff |
| `server/routers/bots.ts` | CRUD de agentes/fluxos, createWithAI, generatePrompt, delete cascata |
| `server/routers/flows.ts` | Engine de execução de fluxos, buildDefaultFlow |
| `server/routers/conversations.ts` | Inbox, sendHumanMessage, humanTakeover |
| `client/src/pages/Agents.tsx` | Editor completo de agente IA (modal grande) |
| `client/src/pages/Flows.tsx` | Lista/criação de fluxos |
| `drizzle/schema.ts` | Schema do banco (fonte da verdade dos tipos) |
| `server/db.ts` | Conexão + migrations ALTER TABLE |

---

## Decisões de arquitetura tomadas (para o futuro)

### Instâncias híbridas (flow + agente no mesmo número) — APROVADO p/ futuro
- O usuário NÃO tem cliente que precise disso agora; fazer só quando surgir demanda.
- Migração será limpa: cada `whatsappInstances` atual vira uma Instância; flow e
  agente já são tipos separados na mesma tabela `bots`, então dá pra linkar um
  segundo bot sem perder dados.
- Regras definidas pelo usuário:
  - Fluxo → Agente: via nó de handoff no fluxo (já existe)
  - Agente → Fluxo: NÃO necessário (agente simula menu via texto)
  - Se os dois ativos sem link: fluxo é o ponto de entrada; sem nó de transferência,
    agente nunca é acionado (sem bug)
  - Operador entra → tudo pausa imediatamente (✅ já implementado)
  - Nome na UI: "Instância"

---

## Próxima tarefa (não iniciada): Redesign do Flow Editor

O usuário quer fluxos MUITO fáceis para negócios locais sem nível técnico
(referência: estilo "ManyChat / construtor visual"). Blocos aprovados:

| Bloco | O que faz |
|---|---|
| 📨 Enviar Mensagem | Texto (com variáveis {{nome}}) |
| 📋 Menu | Opções numeradas |
| ❓ Pergunta | Pergunta e salva resposta |
| 🔀 Condição | Divide fluxo por resposta |
| 📍 Localização | Pin no mapa do WhatsApp |
| ⏱️ Aguardar | Espera X segundos |
| 🤖 Transferir p/ Agente IA | Passa para o agente |
| 👤 Transferir p/ Humano | Notifica equipe, pausa bot |
| 🔚 Encerrar | Finaliza fluxo |

**Operadores de Condição**: contém, é exatamente, começa com, é um número, é diferente de

Visual precisa ser muito intuitivo. Schema atual de flow já tem
`flowNodes` (type: start/message/menu/input/condition/handoff/end) e `flowEdges`.
Precisa adicionar tipos `location` e `delay`, e o bloco de Localização precisa de
suporte no engine (`flows.ts` executeFlowStep) e no envio (baileys sendMessage com
`{ location: { degreesLatitude, degreesLongitude } }`).

---

## Variáveis de ambiente úteis (tuning)

| Var | Default | Função |
|---|---|---|
| `WA_READ_DELAY_MIN` / `MAX` | 2000 / 5000 | Delay antes dos ticks azuis (ms) |
| `WA_DELAY_PER_CHAR` | 55 | ms por caractere (tempo digitando) |
| `WA_DELAY_MAX` | 9000 | Teto do delay de digitação (ms) |
| `WA_BATCH_WINDOW_MS` | 4000 | Janela de batching de mensagens (ms) |
| `OPENAI_API_KEY` | — | Chave OpenAI (chat + Whisper) |
| `ENV_FILE` | /root/atendeai/data/.env | Caminho do .env persistente |

---

## Convenções

- Idioma do produto e mensagens: **português brasileiro**
- Commits terminam com a linha de sessão do Claude Code
- NÃO criar PR sem o usuário pedir
- Sempre push para `claude/peaceful-darwin-RUNJD`
