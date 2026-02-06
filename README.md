# Helvino.io Monorepo

AI-powered chat platform built with modern web technologies.

## 🏗️ Structure

```
helvino/
├── apps/
│   ├── web/          # Next.js frontend (Dashboard & Landing)
│   ├── api/          # Node.js backend (REST API)
│   └── widget/       # Vite React widget (Embeddable chat)
├── packages/
│   └── shared/       # Shared TypeScript utilities & types
└── package.json      # Root workspace config
```

## 🚀 Quick Start

```bash
# Install dependencies
pnpm install

# Run all apps in development mode
pnpm dev

# Build all packages
pnpm build

# Lint all packages
pnpm lint
```

## 📦 Apps

- **web** - `http://localhost:3000` - Next.js dashboard & landing page
- **api** - `http://localhost:4000` - Node.js REST API
- **widget** - `http://localhost:5173` - Embeddable chat widget

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Widget**: Vite, React, TypeScript
- **Shared**: TypeScript utilities & types
- **Package Manager**: pnpm (workspaces)

## 📝 License

MIT © 2026 Helvino Team
