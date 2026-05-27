# AgenSync

AgenSync é uma plataforma de gestão para negócios de atendimento, com agenda, clientes, profissionais, serviços, vendas, mensalidades, financeiro, notificações e painel administrativo da plataforma.

## Stack

- Frontend: React + Vite + Tailwind CSS + React Router
- Backend: Node.js + Express
- Banco: PostgreSQL + Prisma
- Autenticação: API própria ou Supabase Auth
- Push: Firebase Cloud Messaging quando configurado
- App instalável: PWA e base Capacitor para Android

## Estrutura

```text
AgenSync/
  backend/
    prisma/
    src/
      middleware/
      routes/
      services/
      utils/
  frontend/
    public/
    src/
      api/
      components/
      contexts/
      pages/
      services/
```

## Módulos principais

- Dashboard operacional com filtros por período e profissional.
- Agenda semanal, diária e horários de trabalho.
- Clientes, prontuário, fichas, evolução, fotos, documentos e linha do tempo.
- Profissionais, permissões e acesso por perfil.
- Catálogo de serviços e produtos.
- Vendas de produtos, histórico, relatórios e cálculo de comissões.
- Mensalidades e recorrência de atendimentos.
- Financeiro com entradas, despesas, resultado líquido e exportação em Excel.
- Configurações de negócio, notificações, auditoria e instalação PWA.
- Painel da plataforma para contas, planos, status, suporte e auditoria.

## Variáveis de ambiente

Frontend (`frontend/.env`):

```env
VITE_AUTH_PROVIDER="supabase"
VITE_API_URL="http://localhost:3333/api"
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
VITE_SUPABASE_RESET_PASSWORD_REDIRECT_URL="http://localhost:5173/reset-password"
VITE_AUTH_TOKEN_STORAGE_KEY="@agensync-token"
VITE_FIREBASE_API_KEY=""
VITE_FIREBASE_AUTH_DOMAIN=""
VITE_FIREBASE_PROJECT_ID=""
VITE_FIREBASE_MESSAGING_SENDER_ID=""
VITE_FIREBASE_APP_ID=""
VITE_FIREBASE_VAPID_KEY=""
```

Backend (`backend/.env`):

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/agensync?schema=public"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/agensync?schema=public"
JWT_SECRET="troque-este-segredo"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
CRON_SECRET="troque-este-segredo"
PORT=3333
CORS_ORIGIN="http://localhost:5173"
FIREBASE_PROJECT_ID=""
FIREBASE_CLIENT_EMAIL=""
FIREBASE_PRIVATE_KEY=""
ENABLE_PUSH_SEND="0"
```

Nunca exponha `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `CRON_SECRET` ou credenciais Firebase Admin no frontend.

## Como rodar

Instale as dependências:

```bash
npm install
```

Gere o Prisma Client e aplique migrations quando o banco estiver configurado:

```bash
npm run prisma:generate
npm run prisma:migrate
```

Rode a API:

```bash
npm run dev:backend
```

Rode o frontend:

```bash
npm run dev:frontend
```

URLs locais padrão:

- Frontend: `http://127.0.0.1:5173`
- API: `http://localhost:3333/api`

## Build e validação

```bash
npm run build
npx prisma validate --schema backend/prisma/schema.prisma
```

## PWA e Android

O frontend gera manifest e service worker no build de produção.

```bash
npm run build
npm run preview -w frontend
```

Para Capacitor:

```bash
npm run cap:sync
npm run cap:android
npm run cap:open:android
```

O arquivo `frontend/capacitor.config.json` usa `appId` `br.com.agensync.app`, `appName` `AgenSync` e `webDir` `dist`.

## Notificações e lembretes

Notificações internas:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`

Tokens push:

- `POST /api/notification-tokens`

Lembretes de agendamento:

- `POST /api/appointment-reminders/process-due`

O job processa lembretes pendentes, cria notificação interna e envia push quando Firebase Admin está configurado e `ENABLE_PUSH_SEND="1"`.
