# Socket.IO Real-Time Messaging Test

## ✅ Implementation Complete

Socket.IO has been integrated with the existing Fastify REST API **without refactoring** existing routes.

---

## 📦 Dependencies Added

```diff
"dependencies": {
  "@fastify/cors": "^10.0.1",
  "@helvino/shared": "workspace:*",
  "dotenv": "^16.4.7",
  "fastify": "^5.2.1",
+ "fastify-socket.io": "^5.1.0",
+ "socket.io": "^4.8.1"
},
"devDependencies": {
  // ...
+ "socket.io-client": "^4.8.3"
}
```

---

## 🔧 Code Changes in `src/index.ts`

### 1. Import Socket.IO Plugin

```diff
import Fastify from "fastify";
import cors from "@fastify/cors";
+ import socketioServer from "fastify-socket.io";
import dotenv from "dotenv";
```

### 2. Register Socket.IO

```diff
// Register CORS
fastify.register(cors, {
  origin: true,
});

+ // Register Socket.IO
+ fastify.register(socketioServer, {
+   cors: {
+     origin: "*",
+   },
+ });
```

### 3. Add Connection Handlers

```diff
+ // Socket.IO connection handlers
+ fastify.ready().then(() => {
+   fastify.io.on("connection", (socket) => {
+     console.log(`✅ Socket connected: ${socket.id}`);
+ 
+     socket.on("disconnect", () => {
+       console.log(`❌ Socket disconnected: ${socket.id}`);
+     });
+   });
+ });
```

### 4. Emit Event on New Message

```diff
const message = store.addMessage(id, role, content);

if (!message) {
  reply.code(404);
  return { error: "Conversation not found" };
}

+ // Emit Socket.IO event for real-time updates
+ fastify.io.emit("message:new", {
+   conversationId: id,
+   message,
+ });

reply.code(201);
return message;
```

---

## 🧪 How to Test

### Step 1: Start the Server

```bash
cd /Users/yavuz/Desktop/helvino/apps/api
npx pnpm dev
```

You should see:
```
🚀 Helvino API is running!
📡 Health check: http://localhost:4000/health
📚 API docs: http://localhost:4000/
🔌 Socket.IO enabled on the same port
```

### Step 2: Start the Test Client

Open a **new terminal** and run:

```bash
cd /Users/yavuz/Desktop/helvino/apps/api
node test-socket-client.js
```

You should see:
```
🔌 Connecting to Socket.IO server at http://localhost:4000...

✅ Connected to server
   Socket ID: CIkQtqLizAEDJ1NDAAAB

👂 Listening for 'message:new' events...
```

The server console will also show:
```
✅ Socket connected: CIkQtqLizAEDJ1NDAAAB
```

### Step 3: Send a Message via REST API

Open a **third terminal** and run:

```bash
# Create conversation
CONV_ID=$(curl -s -X POST http://localhost:4000/conversations | jq -r '.id')
echo "Created conversation: $CONV_ID"

# Send message
curl -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{
    "role": "user",
    "content": "Testing Socket.IO real-time messaging!"
  }' | jq .
```

### Step 4: Verify Real-Time Event

The **test client terminal** should immediately show:

```
📨 New message received!
   Conversation ID: 1770297768668-6486txvvs
   Message: {
  "id": "1770297768682-szt7r8bvw",
  "conversationId": "1770297768668-6486txvvs",
  "role": "user",
  "content": "Testing Socket.IO real-time messaging!",
  "timestamp": "2026-02-05T13:22:48.682Z"
}
```

---

## 📝 Test Results

### ✅ REST API Still Works

```bash
curl http://localhost:4000/health
# → {"ok":true}

curl -X POST http://localhost:4000/conversations
# → {"id":"...","createdAt":"..."}
```

### ✅ Socket.IO Events Working

```bash
# Client receives "message:new" event
# Event includes: conversationId + full message object
```

### ✅ Connection Logging

Server console shows:
- `✅ Socket connected: <socket-id>` on client connect
- `❌ Socket disconnected: <socket-id>` on client disconnect

---

## 🎯 Key Features

1. **Zero Refactoring** - REST routes unchanged
2. **Same Port** - Socket.IO runs on port 4000 with Fastify
3. **Real-Time Events** - `message:new` emitted on POST success
4. **Clean Integration** - Minimal code changes
5. **Full Typing** - TypeScript support maintained

---

## 📄 Test Client Script

The `test-socket-client.js` file provides a simple Node.js client that:
- Connects to the Socket.IO server
- Listens for `message:new` events
- Logs received data to console

You can use this as a template for widget/frontend integration.

---

## 🚀 Next Steps

- [ ] Add authentication to Socket.IO connections
- [ ] Add room-based messaging (per conversation)
- [ ] Emit more event types (conversation:created, etc.)
- [ ] Add reconnection logic to client
- [ ] Integrate with apps/widget (React)
