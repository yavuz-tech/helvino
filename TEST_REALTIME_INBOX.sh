#!/bin/bash

# Helvino Dashboard Real-Time Inbox Test Script
# Run this while viewing the dashboard to see real-time updates

echo "🧪 Testing Real-Time Dashboard Updates"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Instructions:"
echo "  1. Open http://localhost:3003/dashboard in your browser"
echo "  2. Watch the conversations list AND the debug panel"
echo "  3. This script will send messages and you'll see real-time updates"
echo ""
read -p "Press Enter when dashboard is open..."
echo ""

# Get first conversation ID
CONV_ID=$(curl -s http://localhost:4000/conversations | jq -r '.[0].id')
echo "📍 Using conversation: $CONV_ID"
echo ""

# Send 3 messages with delays to see updates
echo "📨 Sending message 1/3..."
curl -s -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Testing real-time update #1"}' | jq -r '.timestamp'

echo "   ✅ Check dashboard - message count should increment!"
sleep 2

echo ""
echo "📨 Sending message 2/3..."
curl -s -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"assistant","content":"I received your message!"}' | jq -r '.timestamp'

echo "   ✅ Check dashboard - count increments again, timestamp updates!"
sleep 2

echo ""
echo "📨 Sending message 3/3..."
curl -s -X POST http://localhost:4000/conversations/$CONV_ID/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Perfect, real-time works!"}' | jq -r '.timestamp'

echo "   ✅ Final update - conversation should be at top of list!"
echo ""

# Create a new conversation and add message
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🆕 Creating a NEW conversation..."
NEW_CONV=$(curl -s -X POST http://localhost:4000/conversations | jq -r '.id')
echo "   ID: $NEW_CONV"

sleep 1

echo "📨 Adding message to new conversation..."
curl -s -X POST http://localhost:4000/conversations/$NEW_CONV/messages \
  -H "Content-Type: application/json" \
  -d '{"role":"user","content":"Hello from brand new conversation!"}' | jq -r '.timestamp'

echo "   ⚠️  New conversation won't appear in list (not implemented)"
echo "   ✅ Click 'Refresh' button in dashboard to see it"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Test Complete!"
echo ""
echo "🔍 Things to verify in Debug Panel:"
echo "   • GET /conversations 200 (initial load)"
echo "   • POST /conversations/:id/messages 201 (for each message)"
echo "   • Socket.IO status: Connected (green dot)"
echo ""
echo "🎯 Things to verify in Dashboard:"
echo "   • Conversations list auto-updated (no refresh needed)"
echo "   • Message counts incremented"
echo "   • Timestamps updated"
echo "   • List reordered (most recent on top)"
echo ""
