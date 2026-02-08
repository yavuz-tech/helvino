# Embeddable Widget Implementation Summary

## ✅ Completed

Created a Crisp/Tawk.to style embeddable widget loader that works with a simple script tag.

## 📦 Files Created/Modified

### New Files (3)

1. **`apps/widget/src/embed.tsx`** - Embeddable loader script
   - Validates `window.HELVINO_ORG_KEY`
   - Creates `#helvino-widget-root` container
   - Renders React widget
   - Exposes global `window.Helvino` API

2. **`apps/widget/public/embed-demo.html`** - Interactive demo page
   - Shows embedding instructions
   - Interactive API controls
   - Configuration display
   - Console examples

3. **`apps/widget/EMBED_GUIDE.md`** - Complete documentation
   - Usage instructions
   - API reference
   - Troubleshooting
   - CDN deployment guide

### Modified Files (3)

1. **`apps/widget/src/App.tsx`** - External control support
   - Added `AppProps` interface with `externalIsOpen` and `onOpenChange`
   - Changed internal `isOpen` to `actualIsOpen` for external control
   - Backward compatible (props are optional)
   - Removed `@helvino/shared` dependency (hardcoded `APP_NAME`)

2. **`apps/widget/vite.config.ts`** - Build configuration
   - Single entry point: `src/embed.tsx`
   - IIFE format for browser compatibility
   - Output: `dist/embed.js`
   - Inline dynamic imports for single bundle

## 🎯 How It Works

### Embedding (2 lines of code)

```html
<script>window.HELVINO_ORG_KEY = "demo";</script>
<script src="https://cdn.helvion.io/embed.js"></script>
```

### Global API

```javascript
Helvino.open()    // Open widget
Helvino.close()   // Close widget
Helvino.toggle()  // Toggle open/close
Helvino.isOpen()  // Check if open (boolean)
```

### Flow

1. **Page loads** → `embed.js` executes
2. **Validates** → Checks `window.HELVINO_ORG_KEY` exists
3. **Creates container** → Adds `<div id="helvino-widget-root">`
4. **Loads bootloader** → Fetches config from API
5. **Renders widget** → Mounts React app
6. **Exposes API** → `window.Helvino` available

## 📊 Build Output

```
dist/
├── embed.js           # 242 KB (75.77 KB gzipped)
└── embed-demo.html   # Interactive demo
```

Single file includes:
- ✅ React + ReactDOM
- ✅ Socket.IO client
- ✅ Widget UI & logic
- ✅ All CSS styles

## 🧪 Testing

### Build

```bash
cd apps/widget
pnpm build
```

### Serve Locally

```bash
cd apps/widget/dist
npx serve .
```

### Open Demo

```
http://localhost:3000/embed-demo.html
```

### Test API

Open browser console:

```javascript
Helvino.open()
Helvino.close()
Helvino.toggle()
Helvino.isOpen() // returns boolean
```

## ✨ Features

### External Control

```html
<button onclick="Helvino.open()">Chat with us</button>
<button onclick="Helvino.toggle()">Support</button>
```

### Auto-initialization

- Detects `DOMContentLoaded`
- Works on any page
- No manual setup needed

### Error Handling

- Missing `HELVINO_ORG_KEY` → Console error, no render
- Invalid org key → Bootloader error, no render
- Network issues → Widget hidden until resolved

### Bootloader Integration

- Loads organization config from DB
- Respects `widgetEnabled` flag
- Applies theme colors dynamically
- Validates permissions

## 🎨 Customization

Widget respects bootloader config:

```json
{
  "widgetEnabled": true,
  "theme": {
    "primaryColor": "#0F5C5C"
  }
}
```

Colors applied to:
- Toggle button
- User message bubbles
- Send button

## 🚀 Production Deployment

### 1. Build

```bash
pnpm build
```

### 2. Upload to CDN

```bash
# Upload dist/embed.js to CDN
aws s3 cp dist/embed.js s3://cdn.helvion.io/embed.js
```

### 3. Distribute

```html
<!-- Users add to their site -->
<script>window.HELVINO_ORG_KEY = "their-key";</script>
<script src="https://cdn.helvion.io/embed.js"></script>
```

## 📝 Usage Examples

### Basic

```html
<!DOCTYPE html>
<html>
<body>
  <h1>My Website</h1>
  
  <script>window.HELVINO_ORG_KEY = "demo";</script>
  <script src="https://cdn.helvion.io/embed.js"></script>
</body>
</html>
```

### With Custom Trigger

```html
<button onclick="Helvino.open()">
  Need Help? Chat with us!
</button>

<script>window.HELVINO_ORG_KEY = "demo";</script>
<script src="https://cdn.helvion.io/embed.js"></script>
```

### With Analytics

```html
<script>
  window.HELVINO_ORG_KEY = "demo";
  
  // Track widget opens
  window.addEventListener('load', () => {
    const originalOpen = Helvino.open;
    Helvino.open = function() {
      gtag('event', 'widget_open');
      originalOpen.call(this);
    };
  });
</script>
<script src="https://cdn.helvion.io/embed.js"></script>
```

## 🔒 Security

### CSP Headers

```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' https://cdn.helvion.io;">
```

### CORS

API already configured for CORS:
```javascript
// apps/api/src/index.ts
fastify.register(cors, { origin: true });
```

## 🐛 Troubleshooting

### Widget doesn't appear

```javascript
// Check console for:
// ❌ Helvino Widget: HELVINO_ORG_KEY not found...
```

→ Solution: Set `window.HELVINO_ORG_KEY` before loading script

### Build fails

```bash
# Rebuild shared package first
cd packages/shared && pnpm build
cd ../../apps/widget && pnpm build
```

### Dev mode not working

```bash
# Use dev server, not embed.js
pnpm dev
# Open: http://localhost:5173
```

## 📚 Documentation

- **`EMBED_GUIDE.md`**: Complete embedding guide
- **`embed-demo.html`**: Interactive demo
- **`BOOTLOADER_INTEGRATION_GUIDE.md`**: Bootloader details

## 🎯 Key Decisions

1. **IIFE Format**: Browser-compatible, no module system needed
2. **Single Bundle**: All deps included, no external loading
3. **Auto-init**: Works immediately, no manual calls
4. **Global API**: Simple `window.Helvino` object
5. **Minimal Props**: Optional external control, backward compatible

## 🚦 Status

✅ **Build**: Working (`pnpm build`)  
✅ **Embed Script**: `dist/embed.js` (242 KB)  
✅ **Global API**: `window.Helvino` exposed  
✅ **External Control**: Props-based control  
✅ **Demo**: Interactive demo page  
✅ **Documentation**: Complete guides  
✅ **Error Handling**: Validates org key  
✅ **Bootloader**: Integrated  
✅ **Theme**: Dynamic colors  

## 🔮 Future Enhancements

- [ ] Versioned releases (embed.v1.0.0.js)
- [ ] Auto-open triggers (delay, scroll, exit intent)
- [ ] Position configuration (bottom-left, top-right)
- [ ] Custom welcome messages
- [ ] Visitor identification API
- [ ] Event callbacks (onOpen, onClose, onMessage)
- [ ] Widget appearance presets
- [ ] A/B testing support
- [ ] Analytics integration
- [ ] Offline mode support

## 📦 Summary

Embeddable widget implementation complete! Widget can now be embedded on any website with just 2 lines of code, similar to Crisp, Intercom, or Tawk.to.

**Total Changes:**
- 3 new files
- 3 modified files
- 1 build configuration
- Complete documentation
- Working demo

**Bundle Size:**
- 242 KB raw
- 75.77 KB gzipped

**Ready for production deployment!** 🎉
