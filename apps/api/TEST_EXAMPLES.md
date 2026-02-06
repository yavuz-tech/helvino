# Helvino API - Test Examples

## Prerequisites

```bash
# Start the API server
cd /Users/yavuz/Desktop/helvino/apps/api
npx pnpm dev
```

Server will run on `http://localhost:4000`

---

## API Endpoints

### 1. Health Check

```bash
curl http://localhost:4000/health
```

**Response:**
```json
{"ok":true}
```

---

### 2. Create Conversation

```bash
curl -X POST http://localhost:4000/conversations
```

**Response (201):**
```json
{
  "id": "1770297468063-fkhyky6c2",
  "createdAt": "2026-02-05T13:17:48.063Z"
}
```

---

### 3. Add Message to Conversation

```bash
curl -X POST http://localhost:4000/conversations/{CONVERSATION_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "Hello, I need help with my account"
  }'
```

**Response (201):**
```json
{
  "id": "1770297476010-nojnhz4ef",
  "conversationId": "1770297475998-aycy4ezut",
  "role": "user",
  "content": "Hello, I need help with my account",
  "timestamp": "2026-02-05T13:17:56.010Z"
}
```

**Add Assistant Response:**
```bash
curl -X POST http://localhost:4000/conversations/{CONVERSATION_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "role": "assistant",
    "content": "Of course! I would be happy to help you with your account."
  }'
```

---

### 4. List All Conversations

```bash
curl http://localhost:4000/conversations
```

**Response:**
```json
[
  {
    "id": "1770297475998-aycy4ezut",
    "createdAt": "2026-02-05T13:17:55.998Z",
    "updatedAt": "2026-02-05T13:17:56.010Z",
    "messageCount": 1
  },
  {
    "id": "1770297468063-fkhyky6c2",
    "createdAt": "2026-02-05T13:17:48.063Z",
    "updatedAt": "2026-02-05T13:17:48.063Z",
    "messageCount": 0
  }
]
```

---

### 5. Get Conversation Detail (with messages)

```bash
curl http://localhost:4000/conversations/{CONVERSATION_ID}
```

**Response:**
```json
{
  "id": "1770297475998-aycy4ezut",
  "createdAt": "2026-02-05T13:17:55.998Z",
  "updatedAt": "2026-02-05T13:17:56.010Z",
  "messageCount": 1,
  "messages": [
    {
      "id": "1770297476010-nojnhz4ef",
      "conversationId": "1770297475998-aycy4ezut",
      "role": "user",
      "content": "Hello, I need help with my account",
      "timestamp": "2026-02-05T13:17:56.010Z"
    }
  ]
}
```

---

## Complete Workflow Example

```bash
# 1. Create a new conversation
CONV_ID=$(curl -s -X POST http://localhost:4000/conversations | jq -r '.id')
echo "Created conversation: $CONV_ID"

# 2. Add user message
curl -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"What are your pricing plans?"}'

# 3. Add assistant response
curl -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"assistant","content":"We offer three pricing tiers: Starter ($9/mo), Pro ($29/mo), and Enterprise (custom)."}'

# 4. Get full conversation
curl http://localhost:4000/conversations/$CONV_ID | jq .

# 5. List all conversations
curl http://localhost:4000/conversations | jq .
```

---

## Error Responses

### Conversation Not Found (404)
```bash
curl http://localhost:4000/conversations/invalid-id
```

**Response:**
```json
{
  "error": "Conversation not found"
}
```

### Invalid Message Data (400)
```bash
curl -X POST http://localhost:4000/conversations/{CONV_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"invalid"}'
```

**Response:**
```json
{
  "error": "Missing required fields: role, content"
}
```

---

## Notes

- All IDs are generated using `generateId()` from `@helvino/shared`
- Data is stored **in-memory** only (resets on server restart)
- No authentication required (development mode)
- CORS enabled for all origins
