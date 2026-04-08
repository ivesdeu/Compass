# My Agent — 21st SDK + Next.js

This folder is a **standalone Next.js app** that chats with your deployed 21st agent **`my-agent`**. The main IDM dashboard remains the Vite/static app at the repo root.

## Prerequisites

- Node 20+
- A 21st Agents API key (`API_KEY_21ST`)

## Setup

```bash
cd my-agent-next
cp .env.example .env.local
# Edit .env.local and set API_KEY_21ST
npm install
```

## Deploy the agent (from this directory)

```bash
API_KEY_21ST=your_key npx @21st-sdk/cli login --api-key "$API_KEY_21ST"
npx @21st-sdk/cli deploy --agent my-agent
```

Agent source: `agents/my-agent.ts` (CLI scans `agents/`). The file `src/agent.ts` re-exports the same default for parity with the “src/agent.ts” quickstart.

## Run the Next.js app

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The UI uses `/api/an-token` to mint short-lived tokens; your secret key stays on the server.

The **primary chat experience** is at [http://localhost:3000/chat](http://localhost:3000/chat): Tailwind-styled message list + custom `AIChatInput` wired to `useChat` and agent `my-agent`.

## shadcn-style layout & Tailwind

This app is **TypeScript + Tailwind CSS v3** with a **`components.json`** aligned to the shadcn CLI (aliases: `@/components`, `@/components/ui`, `@/lib/utils`).

- **UI primitives** live under `components/ui/` (same convention as shadcn) so you can run `npx shadcn@latest add button` etc. without reorganizing.
- **`lib/utils.ts`** exports `cn()` (`clsx` + `tailwind-merge`).

To initialize more shadcn components from scratch on a greenfield project:

```bash
npx shadcn@latest init
```

(Here we already created `tailwind.config.ts`, `postcss.config.mjs`, and `app/globals.css` with `@tailwind` layers.)

## Chat tab in the main dashboard

The static dashboard (`index.html` at repo root) includes a **Chat** sidebar item that embeds this app in an **iframe**. The URL comes from:

```html
<meta name="chat-embed-url" content="http://localhost:3000/chat" />
```

Change `content` to your deployed chat origin in production. Start the Next app before opening the tab:

```bash
cd my-agent-next && npm run dev
```

## Theme

`app/theme.json` matches the structure from the 21st theme builder (`theme` / `light` / `dark`). Regenerate in the [Theme Builder](https://21st.dev/agents/theme-builder) and replace the file if you want pixel-perfect parity with a saved preset.

## Security

- **Rotate** any API key that has appeared in chat, logs, or screenshots.
- Never commit `.env.local` (repo root `.gitignore` includes it).

## Troubleshooting

- **`legacy-peer-deps`**: This app ships with `.npmrc` so `npm install` succeeds despite a peer mismatch between `@21st-sdk/nextjs` and `@21st-sdk/react` (same approach many 21st examples use once versions drift).
- **Multiple lockfiles warning** during `next build`: Next may warn if other `package-lock.json` files exist above this folder (e.g. home directory). Builds still succeed; you can ignore the warning or run the app from a checkout without extra lockfiles.

## Docs lookup (agents)

For SDK behavior and examples, use the 21st search engine described in `.cursor/skills/21st-sdk/SKILL.md` in this repo.
