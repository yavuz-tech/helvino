# Multi-Tenant Isolation Guide

## Overview

Helvino now supports multi-tenant isolation using an `orgKey` (organization key). Each organization's data is isolated, and real-time events are only broadcast within the organization's scope.

## Architecture

### 1. Organization Model

```typescript
interface Organization {
  id: string;      // Internal ID (e.g., "org_1")
  key: string;     // Public key for API auth (e.g., "demo")
  name: string;    // Display name
}
```

### 2. Default Organization

On boot, the API seeds a default organization:

```json
{
  "id": "org_1",
  "key": "demo",
  "name": "Demo Org"
}
```

## API Changes

### Authentication

All widget-facing endpoints require the `x-org-key` header:

```bash
curl -H "x-org-key: demo" http://localhost:4000/conversations
```

**Affected Endpoints:**
- `POST /conversations`
- `GET /conversations`
- `GET /conversations/:id`
- `POST /conversations/:id/messages`

### Response Codes

- **401**: Missing or invalid `x-org-key`
- **404**: Resource not found (or belongs to another org)

### Data Isolation

- Each `Conversation` is tagged with `orgId`
- `GET /conversations` returns only conversations for the requesting org
- `GET /conversations/:id` validates org ownership
- `POST /conversations/:id/messages` validates org ownership

### Socket.IO Rooms

- Clients must provide `orgKey` in handshake auth:
  ```javascript
  io(apiUrl, {
    auth: { orgKey: "demo" }
  })
  ```
- Each connection joins a room: `org:<orgId>` (e.g., `org:org_1`)
- `message:new` events are emitted to the org room only (not global)

## Widget Configuration

### Setting Organization Key

The widget reads `orgKey` from `window.HELVINO_ORG_KEY`:

```html
<script>
  window.HELVINO_ORG_KEY = "demo";
</script>
<script src="https://widget.helvino.io/embed.js"></script>
```

### Local Testing

For local development, `apps/widget/index.html` already includes:

```html
<script>
  window.HELVINO_ORG_KEY = "demo";
</script>
```

## Web Admin Configuration

### Environment Variable

Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_ORG_KEY=demo
```

### Default Behavior

If `NEXT_PUBLIC_ORG_KEY` is not set, it defaults to `"demo"`.

## Verification Steps

### 1. Test with Valid orgKey

```bash
# Create conversation
curl -X POST -H "x-org-key: demo" http://localhost:4000/conversations

# Response: { "id": "...", "createdAt": "..." }

# List conversations
curl -H "x-org-key: demo" http://localhost:4000/conversations

# Response: [ { "id": "...", "orgId": "org_1", ... } ]
```

### 2. Test with Invalid orgKey

```bash
# Missing header
curl http://localhost:4000/conversations

# Response: 401 { "error": "Missing x-org-key header" }

# Invalid key
curl -H "x-org-key: invalid" http://localhost:4000/conversations

# Response: 401 { "error": "Invalid organization key" }
```

### 3. Test Isolation

```bash
# Org A creates conversation
CONV_A=$(curl -X POST -H "x-org-key: demo" http://localhost:4000/conversations | jq -r .id)

# Org B (if added) should NOT see Org A's conversations
curl -H "x-org-key: other-org" http://localhost:4000/conversations
# Response: []
```

### 4. Test Socket.IO Rooms

**Terminal 1: Connect as demo org**
```bash
node apps/api/test-socket-client.js
# Modify script to include: auth: { orgKey: "demo" }
```

**Terminal 2: Send message as demo org**
```bash
curl -X POST -H "x-org-key: demo" \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Hello"}' \
  http://localhost:4000/conversations/$CONV_ID/messages
```

**Result:** Terminal 1 receives `message:new` event

**Terminal 3: Connect as different org**
```bash
# If another org exists, connect with auth: { orgKey: "other-org" }
```

**Result:** Terminal 3 does NOT receive the `message:new` event from demo org

## Adding More Organizations

Currently, organizations are seeded in-memory. To add more:

1. Edit `apps/api/src/store.ts`:
   ```typescript
   private seedDefaultOrganization(): void {
     const orgs = [
       { id: "org_1", key: "demo", name: "Demo Org" },
       { id: "org_2", key: "acme", name: "Acme Corp" },
     ];
     orgs.forEach(org => this.organizations.set(org.id, org));
   }
   ```

2. Restart API server

## Production Considerations

1. **Database**: Replace in-memory store with PostgreSQL/MongoDB
2. **Org Management**: Add endpoints to create/manage organizations
3. **API Keys**: Use proper API key rotation instead of static `orgKey`
4. **Rate Limiting**: Implement per-org rate limits
5. **Analytics**: Track usage per organization

## Security Notes

- `orgKey` is transmitted in headers (use HTTPS in production)
- Socket.IO handshake auth is validated server-side
- Unauthorized connections are immediately disconnected
- All queries filter by `orgId` to prevent cross-org data leaks

## Troubleshooting

### Widget: "Organization key not configured"
- Ensure `window.HELVINO_ORG_KEY` is set before widget loads
- Check browser console for errors

### API: "Missing x-org-key header"
- Verify header is included in all API requests
- Check `apiFetch()` in `apps/web/src/utils/api.ts`

### Socket.IO: Connection rejected
- Verify `auth: { orgKey }` is passed to `io()` constructor
- Check API logs for connection attempts
- Ensure orgKey is valid

## Files Changed

### API (apps/api)
- `src/types.ts`: Added `Organization`, `Conversation.orgId`
- `src/store.ts`: Added org management, tenant filtering
- `src/index.ts`: Added `x-org-key` auth, Socket.IO rooms

### Widget (apps/widget)
- `src/api.ts`: Added `getOrgKey()`, header injection
- `src/App.tsx`: Added Socket.IO auth
- `index.html`: Added `window.HELVINO_ORG_KEY` example

### Web (apps/web)
- `src/utils/api.ts`: Added `x-org-key` header
- `src/contexts/DebugContext.tsx`: Added Socket.IO auth
- `.env.example`: Added `NEXT_PUBLIC_ORG_KEY`

## Next Steps

- [ ] Add organization CRUD endpoints
- [ ] Implement proper API key management
- [ ] Add per-org usage analytics
- [ ] Implement billing/subscription per org
- [ ] Add org user management (RBAC)
