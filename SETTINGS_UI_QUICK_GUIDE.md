# Settings UI - Quick Guide

## 🚀 Quick Access

**URL:** `http://localhost:3000/dashboard/settings`

**From Dashboard:** Click **"⚙️ Settings"** button in top-right

---

## ⚡ Common Tasks (5-Second Reference)

### Disable Writes (Emergency)

```
1. Open settings page
2. Click "Write Enabled" toggle (turns gray)
3. Click "Save Changes"
```

**Effect:** All POST operations blocked (403)  
**Time:** < 10 seconds

---

### Change Retention Period

```
1. Open settings page
2. Change "Message Retention Days" number
3. Click "Save Changes"
```

**Effect:** Next retention job uses new period  
**Common values:** 30, 90, 365, 2555 days

---

### Enable Hard Delete

```
1. Open settings page
2. Click "Hard Delete on Retention" toggle (turns RED)
3. Read warning carefully
4. Click "Save Changes"
```

**Effect:** Next retention job permanently deletes old messages  
**Warning:** No recovery possible!

---

### Check Last Retention Run

```
1. Open settings page
2. Look at "Last Retention Run" field
```

**Shows:** Timestamp of last job or "Never"

---

## 🎨 UI Controls

### Toggle Switches

**Green = Enabled**
```
[●    ] Enabled
```

**Gray = Disabled**
```
[    ●] Disabled
```

**Red = Danger (Hard Delete)**
```
[●    ] Hard Delete ON
```

---

### Number Input (Retention Days)

```
┌─────────────────────────┐
│ Message Retention Days  │
│ ┌────────┐              │
│ │  365   │              │
│ └────────┘              │
│ Current: 365 days (~1 years)
└─────────────────────────┘
```

**Valid range:** 1-3650 days

---

### Save Button

**Disabled (no changes):**
```
[ Save Changes ] ← Gray, disabled
```

**Enabled (has changes):**
```
⚠️ You have unsaved changes
[ Save Changes ] ← Dark, clickable
```

**Saving:**
```
[ Saving... ] ← Dark, disabled
```

---

## ⚠️ Warnings

### Write Enabled OFF

```
⚠️ Write operations will be blocked (read-only mode).
```

**Impact:**
- POST /conversations blocked (403)
- POST /conversations/:id/messages blocked (403)
- Widget shows "temporarily unavailable"
- Users cannot send messages

---

### Hard Delete ON

```
⚠️ Hard delete permanently removes messages. No recovery possible.
```

**Impact:**
- Messages older than retention period deleted forever
- No backups created before deletion
- Cannot be undone

**Recommended:** Use soft delete (redact) for audit trails

---

## 📊 Settings Reference

### Kill Switches

| Setting | Default | Impact When Disabled |
|---------|---------|---------------------|
| Widget Enabled | ✅ ON | Widget does not render |
| Write Enabled | ✅ ON | POST operations blocked (403) |
| AI Enabled | ✅ ON | AI features disabled (future) |

### Retention Policy

| Setting | Default | Description |
|---------|---------|-------------|
| Retention Days | 365 | Age threshold for cleanup |
| Hard Delete | ❌ OFF | Soft delete (redact) vs hard delete |
| Last Run | Never | Timestamp of last job |

---

## 🔧 Troubleshooting

### "Failed to load settings"

**Fix:**
1. Verify API is running: `curl http://localhost:4000/health`
2. Check INTERNAL_KEY in `.env.local`
3. Restart web dashboard: `npx pnpm dev`

### "Failed to save settings"

**Fix:**
1. Check browser console for errors
2. Verify API logs: `tail apps/api/logs/api.log`
3. Test API directly:
   ```bash
   curl -X PATCH -H "x-internal-key: KEY" -H "Content-Type: application/json" \
     -d '{"writeEnabled":false}' http://localhost:4000/api/org/demo/settings
   ```

### Toggle doesn't change

**Fix:**
1. Hard refresh page (Cmd+Shift+R / Ctrl+Shift+R)
2. Clear browser cache
3. Check for JavaScript errors in console

---

## ✅ Quick Checklist

**Before going live:**
- [ ] Test all toggles work
- [ ] Test retention days input
- [ ] Test save succeeds
- [ ] Test error handling
- [ ] Verify settings persist after save
- [ ] Test kill switch actually blocks operations
- [ ] Verify warnings display correctly

---

## 🎯 One-Minute Tutorial

1. **Open settings page**
   - Dashboard → Click "⚙️ Settings"

2. **Make a change**
   - Click any toggle OR change retention days

3. **Notice indicator**
   - "⚠️ You have unsaved changes" appears
   - Save button becomes enabled

4. **Save changes**
   - Click "Save Changes" button
   - Green banner: "Settings saved successfully"

5. **Verify**
   - Settings persist on page reload
   - Changes take effect in API

**Done!** 🎉

---

## 📱 Access Points

| Location | URL |
|----------|-----|
| Main Dashboard | `http://localhost:3000/dashboard` |
| Settings Page | `http://localhost:3000/dashboard/settings` |
| Back to Dashboard | Click "← Back to Dashboard" link |

---

**Your settings are now just a click away! No more terminal commands needed. ⚙️✅**
