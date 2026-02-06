# Helvino API

Fastify-based REST API for conversation and message management.

## Features

- ✅ **Fastify** - Fast and low overhead web framework
- ✅ **TypeScript** - Fully typed with strict mode
- ✅ **In-Memory Store** - Development-ready data storage
- ✅ **Clean Architecture** - Separated concerns (types, store, routes)
- ✅ **CORS Enabled** - Ready for cross-origin requests
- ✅ **Pretty Logs** - Pino logger with pretty formatting

## Project Structure

```
apps/api/
├── src/
│   ├── index.ts       # Main Fastify server
│   ├── types.ts       # TypeScript interfaces
│   └── store.ts       # In-memory data store
├── package.json
├── tsconfig.json
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/conversations` | Create new conversation |
| `GET` | `/conversations` | List all conversations |
| `GET` | `/conversations/:id` | Get conversation with messages |
| `POST` | `/conversations/:id/messages` | Add message to conversation |

## Installation

```bash
# From monorepo root
cd /Users/yavuz/Desktop/helvino
npx pnpm install

# Or from api directory
cd apps/api
npx pnpm install
```

## Development

```bash
# Start dev server with hot reload
npx pnpm dev

# Build TypeScript
npx pnpm build

# Run production build
npx pnpm start

# Lint code
npx pnpm lint
```

The API will run on `http://localhost:4000`

## Usage Examples

See [TEST_EXAMPLES.md](./TEST_EXAMPLES.md) for complete curl examples.

### Quick Test

```bash
# Health check
curl http://localhost:4000/health

# Create conversation
CONV_ID=$(curl -s -X POST http://localhost:4000/conversations | jq -r '.id')

# Add message
curl -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Hello!"}'

# Get conversation
curl http://localhost:4000/conversations/$CONV_ID | jq .
```

## Type Definitions

All types are defined in `src/types.ts`:

- `Message` - Chat message with role and content
- `Conversation` - Conversation metadata
- `ConversationDetail` - Conversation with messages array
- Request/Response types for each endpoint

## Data Store

Currently using in-memory storage (`src/store.ts`):

- Data persists only during runtime
- Server restart clears all data
- TODO: Replace with database (PostgreSQL/MongoDB)

## Environment Variables

Create `.env` file (see `.env.example`):

```env
PORT=4000
HOST=0.0.0.0
LOG_LEVEL=info
NODE_ENV=development
```

## Next Steps

- [ ] Add database integration (Prisma/Drizzle)
- [ ] Implement authentication
- [ ] Add rate limiting
- [ ] Add validation schemas (Zod)
- [ ] Add OpenAI integration for assistant responses
- [ ] Add WebSocket support for real-time updates
