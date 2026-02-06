/**
 * Socket.IO Test Client
 * 
 * Run this script to listen for real-time message events:
 * node test-socket-client.js
 */

const { io } = require("socket.io-client");

const socket = io("http://localhost:4000", {
  transports: ["websocket", "polling"],
  auth: {
    orgKey: "demo", // Must match a valid org key
  },
});

socket.on("connect", () => {
  console.log("✅ Connected to server");
  console.log(`   Socket ID: ${socket.id}`);
  console.log("\n👂 Listening for 'message:new' events...\n");
});

socket.on("message:new", (data) => {
  console.log("📨 New message received!");
  console.log("   Conversation ID:", data.conversationId);
  console.log("   Message:", JSON.stringify(data.message, null, 2));
  console.log("");
});

socket.on("disconnect", () => {
  console.log("❌ Disconnected from server");
});

socket.on("connect_error", (error) => {
  console.error("❌ Connection error:", error.message);
});

// Keep the script running
console.log("🔌 Connecting to Socket.IO server at http://localhost:4000...\n");
