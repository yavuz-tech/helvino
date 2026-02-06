# Widget Bootloader Integration Guide

## Overview

Widget now loads configuration from the backend bootloader endpoint on initialization.

## Changes Made

### 1. API Service (`apps/widget/src/api.ts`)

Added bootloader integration:

```typescript
export interface BootloaderConfig {
  ok: boolean;
  org: {
    id: string;
    key: string;
    name: string;
  };
  config: {
    widgetEnabled: boolean;
    aiEnabled: boolean;
    language: string;
    theme: {
      primaryColor: string;
    };
  };
  env: string;
  timestamp: string;
}

export async function loadBootloader(): Promise<BootloaderConfig> {
  const response = await fetch(`${API_URL}/api/bootloader`, {
    method: "GET",
    headers: {
      "x-org-key": getOrgKey(),
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to load bootloader config");
  }

  return response.json();
}
```

### 2. Widget Component (`apps/widget/src/App.tsx`)

**State Management:**
```typescript
const [bootloaderConfig, setBootloaderConfig] = useState<BootloaderConfig | null>(null);
const [bootloaderError, setBootloaderError] = useState<string | null>(null);
```

**Load Config on Mount:**
```typescript
useEffect(() => {
  const initBootloader = async () => {
    try {
      const config = await loadBootloader();
      console.log("Bootloader config loaded", config);
      setBootloaderConfig(config);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load bootloader";
      console.error("❌ Bootloader error:", errorMessage);
      setBootloaderError(errorMessage);
    }
  };

  initBootloader();
}, []);
```

**Conditional Rendering:**
```typescript
// Don't render if bootloader failed
if (bootloaderError) {
  return null;
}

// Don't render while loading
if (!bootloaderConfig) {
  return null;
}

// Don't render if widget is disabled
if (!bootloaderConfig.config.widgetEnabled) {
  return null;
}
```

**Apply Theme:**
```typescript
const primaryColor = bootloaderConfig.config.theme.primaryColor;

<div style={{ "--primary-color": primaryColor } as React.CSSProperties}>
  <button style={{ backgroundColor: primaryColor }}>
```

### 3. Styles (`apps/widget/src/App.css`)

Updated to use CSS custom property:

```css
.message.user .message-content {
  background: var(--primary-color, #000);
  /* ... */
}

.chat-input button {
  background: var(--primary-color, #000);
  /* ... */
}
```

## Behavior

### Success Flow

1. **Widget loads** → Calls `GET /api/bootloader` with `x-org-key` header
2. **Config received** → Logs to console: `"Bootloader config loaded"` + full config
3. **Check widgetEnabled** → If `false`, widget does not render
4. **Apply theme** → Primary color applied to buttons and user messages
5. **Store config** → `aiEnabled` and `language` stored in state (for future use)

### Error Flow

1. **Missing orgKey** → API returns 400 → Widget does not render → Console error
2. **Invalid orgKey** → API returns 404 → Widget does not render → Console error
3. **Network error** → Widget does not render → Console error

## Testing

### 1. Valid Organization

```bash
# Ensure API is running
curl -H "x-org-key: demo" http://localhost:4000/api/bootloader

# Open widget
open http://localhost:5173
```

**Expected:**
- Widget renders
- Console shows: `"Bootloader config loaded"` + config object
- Button color is `#0F5C5C` (teal)
- User message bubbles are teal
- Send button is teal

### 2. Widget Disabled

**Temporarily disable widget in bootloader response:**
```typescript
// In apps/api/src/routes/bootloader.ts, change:
widgetEnabled: false, // instead of true
```

**Expected:**
- Widget does not render at all
- No errors in console (just doesn't show up)

### 3. Invalid Org Key

**Change `window.HELVINO_ORG_KEY` in `index.html`:**
```html
<script>
  window.HELVINO_ORG_KEY = "invalid-key";
</script>
```

**Expected:**
- Widget does not render
- Console error: `"❌ Bootloader error: Organization not found"`

### 4. Missing Org Key

**Remove `window.HELVINO_ORG_KEY` from `index.html`**

**Expected:**
- Widget does not render
- Console error: `"HELVINO_ORG_KEY not set on window object"`

## Console Output

**Successful load:**
```
Bootloader config loaded {
  ok: true,
  org: { id: "...", key: "demo", name: "Demo Org" },
  config: {
    widgetEnabled: true,
    aiEnabled: true,
    language: "en",
    theme: { primaryColor: "#0F5C5C" }
  },
  env: "dev",
  timestamp: "2026-02-05T..."
}
```

**Error:**
```
❌ Bootloader error: Organization not found
```

## Configuration Options

Current config structure (expandable):

```typescript
config: {
  widgetEnabled: boolean;    // Master on/off switch
  aiEnabled: boolean;        // AI features (future)
  language: string;          // UI language (future)
  theme: {
    primaryColor: string;    // Applied to buttons & user messages
  }
}
```

## Future Enhancements

- [ ] Retry logic on bootloader failure
- [ ] Cache bootloader config (localStorage)
- [ ] Loading spinner while fetching config
- [ ] Fallback UI if bootloader fails
- [ ] Use `aiEnabled` flag for AI features
- [ ] Use `language` for i18n
- [ ] Additional theme properties (secondaryColor, fontFamily, etc.)
- [ ] Widget position configuration
- [ ] Custom welcome message from config

## Troubleshooting

### Widget doesn't appear

1. Check browser console for errors
2. Verify `window.HELVINO_ORG_KEY` is set
3. Test bootloader endpoint directly:
   ```bash
   curl -H "x-org-key: demo" http://localhost:4000/api/bootloader
   ```
4. Ensure API server is running on port 4000

### Theme color not applied

1. Check browser DevTools → Inspect widget button
2. Verify `style="background-color: #0F5C5C"` is present
3. Check CSS custom property `--primary-color` on container

### Console errors

- **"HELVINO_ORG_KEY not set"** → Add to `index.html`
- **"orgKey required"** → Header not sent, check `api.ts`
- **"Organization not found"** → Invalid key or missing in DB

## Summary

✅ **Bootloader integration complete**  
✅ **Widget loads config from database**  
✅ **widgetEnabled flag respected**  
✅ **Theme color visibly applied**  
✅ **Error handling implemented**  
✅ **Console debugging enabled**  
✅ **No breaking changes to existing features**
