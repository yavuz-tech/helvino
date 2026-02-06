# Widget ↔ API Integration Complete ✅

The widget now communicates with the REST API and receives real-time updates via Socket.IO.

---

## 📦 Files Changed

### `apps/widget/package.json`
```diff
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@helvino/shared": "workspace:*",
+   "socket.io-client": "^4.8.1"
  }
```

### `apps/widget/.env.example` ✨ NEW
```env
VITE_API_URL=http://localhost:4000
```

### `apps/widget/.env` ✨ NEW
```env
VITE_API_URL=http://localhost:4000
```

### `apps/widget/src/api.ts` ✨ NEW
```typescript
// API service with:
- createConversation() → POST /conversations
- sendMessage(conversationId, content) → POST /conversations/:id/messages
- TypeScript interfaces: Message, Conversation
- Environment variable: VITE_API_URL
```

### `apps/widget/src/App.tsx` ♻️ UPDATED
**Key Changes:**
- Import Socket.IO client
- State: `conversationId`, `messages[]`, `inputValue`, `isLoading`
- On widget open: Create/retrieve conversation from localStorage
- Connect to Socket.IO and listen for `message:new` events
- Filter incoming messages by `conversationId`
- Send messages via REST API
- Display messages with role-based styling
- Keyboard support (Enter to send)

### `apps/widget/src/App.css` ♻️ UPDATED
**New Styles:**
- Message bubbles: `.message.user` (right, black), `.message.assistant` (left, gray)
- Timestamps
- Loading/disabled states
- Smooth scrolling

---

## 🔧 Environment Variable

### `.env.example` (commit this)
```env
VITE_API_URL=http://localhost:4000
```

### `.env` (local only, in .gitignore)
```env
VITE_API_URL=http://localhost:4000
```

**Note:** Vite requires `VITE_` prefix for env vars to be exposed to client.

---

## 🚀 How to Run and Test Locally

### Prerequisites
Both API and Widget servers must be running.

### Terminal 1: Start API
```bash
cd /Users/yavuz/Desktop/helvino/apps/api
npx pnpm dev
```

**Expected Output:**
```
🚀 Helvino API is running!
📡 Health check: http://localhost:4000/health
📚 API docs: http://localhost:4000/
🔌 Socket.IO enabled on the same port

[13:22:13 UTC] INFO: Server listening at http://127.0.0.1:4000
```

### Terminal 2: Start Widget
```bash
cd /Users/yavuz/Desktop/helvino/apps/widget
npx pnpm dev
```

**Expected Output:**
```
VITE v6.4.1  ready in 597 ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## 🧪 Testing Steps

### Step 1: Open Widget
1. Navigate to `http://localhost:5173/`
2. Click "Open Chat" button

**Behind the scenes:**
- Widget checks localStorage for `helvino_conversation_id`
- If not found: POST `/conversations` → stores ID in localStorage
- Connects to Socket.IO at `ws://localhost:4000`
- Console shows: `✅ Connected to Socket.IO`

**Verify in DevTools:**
- **Console:** `✅ Connected to Socket.IO`
- **Network:** `POST http://localhost:4000/conversations` (Status: 201)
- **Application → Local Storage:** `helvino_conversation_id: <id>`

**API Console Shows:**
```
✅ Socket connected: <socket-id>
```

### Step 2: Send a User Message
1. Type: "Hello, I need help with my account"
2. Press Enter or click "Send"

**Expected Behavior:**
- Message appears immediately in black bubble (right side)
- Timestamp shown below message
- Input field clears
- Send button briefly shows "..."

**Verify in DevTools:**
- **Network:** `POST http://localhost:4000/conversations/<id>/messages`
  - Request: `{"role":"user","content":"Hello, I need help with my account"}`
  - Response (201): Full message object with `id`, `timestamp`
- **Console:** May see Socket.IO event received (filtering prevents duplicate display)

### Step 3: Simulate Real-Time Message from API

Open **Terminal 3** and send a message as "assistant":

```bash
# Get conversation ID from widget's localStorage or network tab
CONV_ID="<your-conversation-id>"

curl -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{
    "role": "assistant",
    "content": "Thank you for reaching out! I would be happy to help you with your account."
  }'
```

**Expected Behavior:**
- Widget instantly shows assistant message in gray bubble (left side)
- No page refresh needed
- Timestamp appears below message

**Verify:**
- Message appears in widget within milliseconds
- API console shows Socket.IO emitting `message:new`
- Widget console may log the received event

### Step 4: Multiple Conversations

1. Open widget in Browser 1
2. Open `http://localhost:5173/` in Browser 2 (or incognito)
3. Each creates a different `conversationId`
4. Send messages from both
5. **Important:** Each widget only shows its own conversation messages (filtered by ID)

---

## 🔍 Quick Verification Commands

### 1. Check API Health
```bash
curl http://localhost:4000/health
# → {"ok":true}
```

### 2. List All Conversations
```bash
curl http://localhost:4000/conversations | jq .
# → [{"id":"...","createdAt":"...","messageCount":1}]
```

### 3. Get Conversation with Messages
```bash
CONV_ID="<from localStorage>"
curl http://localhost:4000/conversations/$CONV_ID | jq .
# → Shows full conversation with messages array
```

### 4. Test Socket.IO Server
```bash
cd /Users/yavuz/Desktop/helvino/apps/api
node test-socket-client.js
# → ✅ Connected to server
# → 👂 Listening for 'message:new' events...
```

---

## 📊 Data Flow

```
┌─────────────┐
│   Widget    │
│ (Browser)   │
└──────┬──────┘
       │
       │ 1. POST /conversations
       ├──────────────────────┐
       │                      │
       │ 2. Response: {id}    │
       │◄─────────────────────┤
       │                      │
       │ 3. Store in          │
       │    localStorage      │
       │                      │
       │ 4. Connect Socket.IO │
       ├──────────────────────┤
       │                      │
       │ 5. User sends msg    │
       │                      │
       │ 6. POST /conv/:id/   │
       │    messages          │
       ├──────────────────────┐
       │                      │
       │ 7. Emit "message:new"│
       │◄─────────────────────┤
       │    via Socket.IO     │
       │                      │
       │ 8. Filter by convId  │
       │    & append to UI    │
       │                      │
       └──────────────────────┘
                              
           ┌──────────┐
           │   API    │
           │(Fastify) │
           └──────────┘
```

---

## ✅ Features Implemented

| Feature | Status | Description |
|---------|--------|-------------|
| **Conversation Creation** | ✅ | POST /conversations on widget open |
| **localStorage Persistence** | ✅ | Stores conversationId for session |
| **Socket.IO Connection** | ✅ | Real-time WebSocket connection |
| **Send Messages** | ✅ | POST messages via REST API |
| **Receive Messages** | ✅ | Listen to `message:new` events |
| **Message Filtering** | ✅ | Only shows messages for current conversation |
| **Message Display** | ✅ | User (right/black), Assistant (left/gray) |
| **Timestamps** | ✅ | Shows time for each message |
| **Loading States** | ✅ | Button shows "..." while sending |
| **Keyboard Support** | ✅ | Enter to send, Shift+Enter for newline |

---

## 🐛 Troubleshooting

### Widget can't connect to API

**Symptom:** Network errors, messages don't send  
**Check:**
1. Is API running? → `curl http://localhost:4000/health`
2. Is `.env` file present in `apps/widget/`?
3. Restart widget server after changing `.env`

### Socket.IO not connecting

**Symptom:** No console log "✅ Connected to Socket.IO"  
**Check:**
1. API shows "🔌 Socket.IO enabled" on startup
2. Browser console for connection errors
3. Check `VITE_API_URL` in widget `.env`

### Messages not appearing in widget

**Symptom:** Message sent but not shown  
**Check:**
1. Browser Network tab: POST should return 201
2. Response body has `conversationId` field
3. Widget console: Socket.IO event received
4. `conversationId` in event matches localStorage value

### "Failed to create conversation"

**Symptom:** Widget opens but conversation not created  
**Check:**
1. API is running and accessible
2. Check browser Network tab for failed request
3. API console for errors

---

## 📝 Summary

**What Changed:**
- Widget now talks to real API (no mock data)
- Real-time updates via Socket.IO
- Conversation persistence in localStorage
- Full TypeScript typing
- Clean separation: `api.ts` for HTTP, `App.tsx` for UI/Socket.IO

**What Works:**
- ✅ Create conversations
- ✅ Send messages (REST)
- ✅ Receive messages (Socket.IO)
- ✅ Multi-user filtering (by conversationId)
- ✅ Persistent conversations (localStorage)
- ✅ Clean UI with message bubbles

**Ready for:**
- AI assistant integration (add OpenAI to API)
- Production deployment (change VITE_API_URL)
- Embedding in external websites
