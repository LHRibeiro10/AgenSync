# AgenSync

MVP web para gestão de atendimentos de prestadores de serviço com agenda, clientes, serviços, histórico e financeiro simples.

O frontend está em modo local por padrão para testes rápidos: os dados mockados são criados automaticamente e salvos no `localStorage` do navegador. O backend com PostgreSQL/Prisma continua no projeto para a próxima fase.

## Stack

- Frontend: React + Vite + Tailwind CSS + React Router
- Backend: Node.js + Express
- Banco: PostgreSQL + Prisma
- Autenticação: JWT

## Estrutura de pastas

```text
AgenSync/
  backend/
    prisma/
      schema.prisma
      migrations/20260413000000_init/migration.sql
    src/
      middleware/
      routes/
      utils/
      app.js
      prisma.js
      server.js
  frontend/
    public/
      AgenSync.png
    src/
      api/
      auth/
      components/
      pages/
      App.jsx
      main.jsx
      styles.css
```

## Arquitetura de transição (frontend)

O frontend agora está preparado para troca gradual de mocks por backend real:

- `src/config/`: leitura centralizada de variáveis de ambiente.
- `src/lib/http/`: cliente HTTP centralizado, erros e query helpers.
- `src/lib/supabase/`: inicialização do client Supabase e utilitários de auth.
- `src/api/modules/`: contratos por domínio (`auth`, `clients`, `appointments`, `products`, `expenses`, `documents`, `monthly plans`).
- `src/services/`: camada de aplicação (`authService`, `clientService`, `appointmentService`, `financeService`, `documentService`, `productService`, `monthlyPlanService`).
- `src/mocks/`: mocks isolados (`localApi` e `legacy`) para fallback.
- `src/contexts/`: contexto global de autenticação.
- `src/types/`: modelos e contratos de endpoints.

O arquivo `src/api/client.js` foi mantido como fachada de compatibilidade para as páginas antigas, mas agora delega para os services organizados.

## Schema Prisma

O schema possui quatro modelos principais:

- `User`: nome, email, senha com hash, nome do negócio e tipo de negócio.
- `Client`: cliente vinculado ao usuário, com nome, telefone e observações.
- `Service`: serviço vinculado ao usuário, com preço padrão, duração e status ativo/inativo.
- `Appointment`: agendamento vinculado ao usuário, cliente e serviço, com início, fim, valor, observações e status.

Status de agendamento no banco:

- `SCHEDULED`
- `COMPLETED`
- `CANCELED`
- `NO_SHOW`

Na API, eles são expostos como:

- `agendado`
- `concluido`
- `cancelado`
- `nao_compareceu`

## Rotas da API

Base local: `http://localhost:3333/api`

Autenticação:

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

Clientes:

- `GET /clients`
- `POST /clients`
- `GET /clients/:id`
- `PUT /clients/:id`
- `DELETE /clients/:id`

Serviços:

- `GET /services`
- `GET /services?active=true`
- `POST /services`
- `GET /services/:id`
- `PUT /services/:id`
- `DELETE /services/:id`

Agendamentos:

- `GET /appointments`
- `GET /appointments?date=YYYY-MM-DD`
- `GET /appointments?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&clientId=...&status=...`
- `POST /appointments`
- `GET /appointments/:id`
- `PUT /appointments/:id`
- `DELETE /appointments/:id`

Indicadores:

- `GET /dashboard?date=YYYY-MM-DD`
- `GET /finance?date=YYYY-MM-DD`
- `GET /health`

## Regras implementadas

- No modo local, cada usuário acessa apenas os dados salvos para o próprio `userId`.
- No backend, cada rota autenticada também filtra os dados por `userId`.
- JWT protege clientes, serviços, agendamentos, dashboard e financeiro.
- Conflitos de horário são bloqueados por sobreposição de `startsAt` e `endsAt`.
- A hora final do agendamento é calculada pela duração do serviço.
- O valor do agendamento vem do preço padrão do serviço, mas pode ser editado.
- Serviços inativos não aparecem para novos agendamentos.
- Clientes com agendamentos vinculados não podem ser excluídos.
- Serviços com agendamentos vinculados não podem ser excluídos; devem ser inativados.
- Apenas agendamentos concluídos entram nos totais financeiros.
- Erros da API retornam mensagens claras em JSON.

## Páginas criadas

- Login e cadastro
- Dashboard
- Clientes
- Serviços
- Agendamentos
- Agenda diária
- Histórico
- Financeiro

## Como rodar

Instale as dependências:

```bash
npm install
```

Rode o frontend:

```bash
cd frontend
npm run dev
```

Acesse:

- Frontend: `http://127.0.0.1:5173`

## Login de teste

Na primeira abertura, o app cria uma base local com:

```text
Email: teste@agensync.com
Senha: 123456
```

Esses dados ficam no `localStorage` na chave `agensync_local_db_v1`. Para resetar os dados de teste, limpe o armazenamento local do navegador para o domínio `127.0.0.1:5173`.

## Modo de dados

O arquivo `frontend/.env` define:

```env
VITE_DATA_MODE="local"
VITE_AUTH_PROVIDER="api"
VITE_API_URL="http://localhost:3333/api"
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
VITE_SUPABASE_RESET_PASSWORD_REDIRECT_URL="http://localhost:5173/reset-password"
VITE_AUTH_TOKEN_STORAGE_KEY="agensync_token"
VITE_ENABLE_MOCK_FALLBACK="true"
```

Com isso, o frontend usa dados locais persistidos no navegador.

Mais para frente, quando for ligar no backend real, altere para:

```env
VITE_DATA_MODE="remote"
VITE_AUTH_PROVIDER="api"
VITE_API_URL="http://localhost:3333/api"
```

Para usar autenticação Supabase no frontend:

```env
VITE_DATA_MODE="remote"
VITE_AUTH_PROVIDER="supabase"
VITE_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
VITE_SUPABASE_ANON_KEY="SUA_CHAVE_PUBLICA"
VITE_SUPABASE_RESET_PASSWORD_REDIRECT_URL="http://localhost:5173/reset-password"
```

## Backend e banco para a próxima fase

Configure o banco em `backend/.env` quando for usar PostgreSQL.

O arquivo já foi criado com uma URL local padrão:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agensync?schema=public"
JWT_SECRET="agensync-local-dev-secret-change-me"
SUPABASE_URL="https://SEU-PROJETO.supabase.co"
SUPABASE_SERVICE_ROLE_KEY="SUA_CHAVE_SECRETA_SERVICE_ROLE"
PORT=3333
CORS_ORIGIN="http://localhost:5173"
```

As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são obrigatórias quando o frontend usa Supabase Auth, pois a exclusão de conta precisa remover também o usuário em Authentication > Users. Nunca exponha a chave `service_role` no frontend.

Se seu PostgreSQL usa outra senha, troque a senha na `DATABASE_URL`.

Crie o banco `agensync` no PostgreSQL, se ele ainda não existir.

Com o banco acessível, aplique a migration e gere o Prisma Client:

```bash
cd backend
npm run prisma:migrate -- --name init
npm run prisma:generate
```

Em um terminal, rode o backend:

```bash
cd backend
npm run dev
```
- API: `http://localhost:3333/api`

## Validações executadas

```bash
npm run build
npx prisma validate
node --check backend/src/**/*.js
```

O build do frontend passou e o schema Prisma está válido. A migration não foi aplicada automaticamente porque o PostgreSQL local recusou a senha padrão `postgres`; ajuste `backend/.env` com a senha real do seu PostgreSQL e rode os comandos acima.

## Próximos passos recomendados

- Criar testes automatizados para as regras de conflito e faturamento.
- Adicionar paginação em histórico e agendamentos.
- Adicionar máscara de telefone e moeda no frontend.
- Criar lembretes internos ou exportação de agenda em uma próxima versão.
- Preparar scripts de deploy e variáveis seguras para produção.
## PWA e Android

O frontend continua sendo um site Vite normal, mas agora tambem gera manifest e service worker de PWA no build de producao.

Comandos principais:

```bash
npm run dev:frontend
npm run build
npm run preview -w frontend
```

Para testar instalacao PWA em desktop/Android:

1. Rode `npm run build`.
2. Rode `npm run preview -w frontend`.
3. Abra `http://127.0.0.1:4173`.
4. No Chrome/Edge, confira o manifest e o service worker em DevTools > Application.
5. Use o prompt nativo de instalacao quando o botao "Instalar AgenSync" aparecer.

O service worker cacheia apenas assets estaticos e navegacao HTML de forma conservadora. Respostas da API recebem `Cache-Control: no-store` no backend, e chamadas autenticadas sensiveis nao sao cacheadas pelo service worker.

Base Capacitor preparada:

```bash
npm run cap:sync
npm run cap:android
npm run cap:open:android
```

O arquivo `frontend/capacitor.config.json` usa `appId` `br.com.agensync.app`, `appName` `AgenSync` e `webDir` `dist`. A pasta Android nao foi adicionada automaticamente para evitar entrada grande desnecessaria nesta etapa; `npm run cap:android` cria a base quando for abrir no Android Studio.

## Notificacoes

Notificacoes internas funcionam pela API autenticada:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

Tokens push FCM sao registrados em:

- `POST /api/notification-tokens`

Variaveis de ambiente para habilitar Firebase no frontend:

```env
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
VITE_FIREBASE_VAPID_KEY=""
```

O service worker de background (`frontend/public/firebase-messaging-sw.js`) le `frontend/public/firebase-messaging-config.json`. Preencha esse JSON no deploy com os mesmos dados publicos do Firebase Web App.

Variaveis de ambiente do backend para envio via Firebase Admin:

```env
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
ENABLE_PUSH_SEND="0"
```

Por seguranca, o backend so envia push real quando `ENABLE_PUSH_SEND="1"`. Sem essas variaveis, o app segue funcionando com notificacoes internas e sem impacto no carregamento inicial.

## Lembretes de agendamento

Novos agendamentos criam lembretes pendentes em `AppointmentReminder` para:

- `ONE_DAY_BEFORE`
- `TWO_HOURS_BEFORE`
- `THIRTY_MINUTES_BEFORE`

O processamento foi preparado para cron externo ou scheduler:

```http
POST /api/appointment-reminders/process-due
```

O job busca apenas lembretes `PENDING` vencidos, limita lote, marca como `PROCESSING`, cria notificacao interna, tenta push quando configurado e finaliza como `SENT` ou `FAILED`.
