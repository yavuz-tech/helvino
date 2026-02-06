# Widget Integration Guide

## ✅ Widget Connected to API + Socket.IO

The widget now communicates with the Fastify API and receives real-time updates via Socket.IO.

---

## 📁 Files Changed

### 1. `package.json`
```diff
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@helvino/shared": "workspace:*",
+   "socket.io-client": "^4.8.1"
  }
```

### 2. `.env.example` (NEW)
```env
VITE_API_URL=http://localhost:4000
```

### 3. `src/api.ts` (NEW)
- `createConversation()` - POST /conversations
- `sendMessage(conversationId, content)` - POST /conversations/:id/messages
- Types: `Message`, `Conversation`

### 4. `src/App.tsx` (UPDATED)
- **On widget open**: Creates conversation, stores ID in localStorage
- **Sending**: POST message via REST API
- **Receiving**: Socket.IO listener for `message:new` events
- **Display**: Shows all messages with timestamps
- **State management**: React hooks for messages, loading, connection

### 5. `src/App.css` (UPDATED)
- Message bubbles (user: right/black, assistant: left/gray)
- Timestamps
- Loading states
- Disabled states

---

## 🔧 Environment Setup

### Create `.env` file:

```bash
cd /Users/yavuz/Desktop/helvino/apps/widget
cp .env.example .env
```

**Content:**
```env
VITE_API_URL=http://localhost:4000
```

---

## 🚀 How to Run Locally

### Step 1: Start the API Server

```bash
# Terminal 1
cd /Users/yavuz/Desktop/helvino/apps/api
npx pnpm dev

# Should show:
# 🚀 Helvino API is running!
# 📡 Health check: http://localhost:4000/health
# 🔌 Socket.IO enabled on the same port
```

### Step 2: Start the Widget

```bash
# Terminal 2
cd /Users/yavuz/Desktop/helvino/apps/widget
npx pnpm dev

# Should show:
# VITE v6.x.x ready in XXX ms
# ➜ Local: http://localhost:5173/
```

### Step 3: Open Widget in Browser

1. Navigate to: `http://localhost:5173/`
2. Click "Open Chat" button
3. Widget will:
   - Create a new conversation (check Network tab)
   - Connect to Socket.IO (check Console)
   - Store `conversationId` in localStorage

---

## 🧪 Test the Integration

### Test 1: Send a User Message

1. Type a message in the widget: "Hello, I need help!"
2. Click "Send" or press Enter
3. **Expected behavior:**
   - Message appears immediately in the UI (black bubble, right side)
   - Network tab shows: `POST /conversations/:id/messages`
   - Socket.IO event `message:new` is emitted

### Test 2: Real-Time Updates

Open browser DevTools console to see:
```
✅ Connected to Socket.IO
```

When you send a message, you'll see the Socket.IO event being received (even though it's your own message, confirming the real-time loop works).

### Test 3: Verify localStorage

Open DevTools → Application → Local Storage → `http://localhost:5173`

You should see:
```
Key: helvino_conversation_id
Value: <conversation-id>
```

### Test 4: Multi-User Simulation

1. Keep widget open in Browser 1
2. Open widget in Browser 2 (new incognito window)
3. Send message from Browser 2
4. Both widgets will receive the `message:new` event
5. **Important:** Each widget filters messages by its own `conversationId`

---

## 🔍 Debug Commands

### Check API is running:
```bash
curl http://localhost:4000/health
# → {"ok":true}
```

### Check conversation was created:
```bash
curl http://localhost:4000/conversations
# → [{"id":"...","createdAt":"...","messageCount":0}]
```

### Check Socket.IO is working:
```bash
cd /Users/yavuz/Desktop/helvino/apps/api
node test-socket-client.js
# → ✅ Connected to server
```

---

## 📊 Flow Diagram

```
User Opens Widget
     ↓
Check localStorage for conversationId
     ↓
     ├─ Found → Use existing
     └─ Not Found → POST /conversations → Store in localStorage
     ↓
Connect to Socket.IO (ws://localhost:4000)
     ↓
Listen for "message:new" events
     ↓
User Types Message → Click Send
     ↓
POST /conversations/:id/messages
     ↓
API emits Socket.IO event: "message:new"
     ↓
Widget receives event → Filters by conversationId → Appends to UI
```

---

## 🎯 Key Features

✅ **Conversation Persistence** - ID stored in localStorage  
✅ **REST API Integration** - POST messages via Fastify  
✅ **Real-Time Updates** - Socket.IO for instant messaging  
✅ **Message Filtering** - Only shows messages for current conversation  
✅ **Loading States** - Button disabled during send  
✅ **Keyboard Support** - Enter to send, Shift+Enter for new line  
✅ **Timestamps** - Each message shows time sent  

---

## 🐛 Common Issues

### Issue 1: CORS Error
**Symptom:** Browser console shows CORS error  
**Solution:** API already has CORS enabled for all origins in dev mode

### Issue 2: Socket.IO Not Connecting
**Symptom:** No "✅ Connected" message in console  
**Solution:** 
- Check API is running on port 4000
- Check `.env` has correct `VITE_API_URL`
- Restart widget dev server after changing `.env`

### Issue 3: Messages Not Appearing
**Symptom:** Message sent but not shown in UI  
**Solution:**
- Check Network tab: POST should return 201
- Check Console: Socket.IO event should be received
- Verify `conversationId` matches in event payload

### Issue 4: "Failed to create conversation"
**Symptom:** Widget opens but can't send messages  
**Solution:**
- Ensure API is running
- Check `VITE_API_URL` in `.env`
- Check browser Network tab for failed request

---

## 🚀 Next Steps

- [ ] Add AI assistant auto-reply (OpenAI integration in API)
- [ ] Add typing indicators
- [ ] Add message delivery status
- [ ] Add conversation history (load previous messages)
- [ ] Add file upload support
- [ ] Add emoji picker
- [ ] Add markdown rendering for bot responses
