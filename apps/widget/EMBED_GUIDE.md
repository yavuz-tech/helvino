# Helvino Widget - Embeddable Loader Guide

## Overview

The Helvino widget can now be embedded on any website using a simple script tag, similar to Crisp, Intercom, or Tawk.to.

## Quick Start

Add these two lines before the closing `</body>` tag:

```html
<script>
  window.HELVINO_ORG_KEY = "your-org-key";
</script>
<script src="https://cdn.helvion.io/embed.js"></script>
```

That's it! The widget will automatically load and appear on your page.

## How It Works

### 1. Loader Script (`embed.js`)

The embed script:
- Checks for `window.HELVINO_ORG_KEY`
- Creates a container div (`#helvino-widget-root`)
- Loads the React widget
- Exposes a global API: `window.Helvino`

### 2. Global API

```javascript
// Open the widget
Helvino.open();

// Close the widget
Helvino.close();

// Toggle widget (open/close)
Helvino.toggle();

// Check if widget is open
Helvino.isOpen(); // returns boolean
```

### 3. External Control

The widget can be controlled from your website's JavaScript:

```html
<button onclick="Helvino.open()">Contact Support</button>
<button onclick="Helvino.toggle()">Chat with Us</button>
```

## Implementation Details

### Files

**1. `src/embed.tsx`** - Loader entry point
- Validates `HELVINO_ORG_KEY`
- Creates root container
- Renders React app
- Exposes global API

**2. `src/App.tsx`** - Widget component (minimal changes)
- Added `externalIsOpen` prop for external control
- Added `onOpenChange` callback
- Maintains backward compatibility

**3. `vite.config.ts`** - Build configuration
- Multiple entry points: `main` (dev) and `embed` (production)
- IIFE format for embed.js
- Single bundle output

### Build Process

```bash
# Development
pnpm dev  # Starts dev server on http://localhost:5173

# Production
pnpm build  # Generates dist/embed.js
```

### Output Structure

```
dist/
├── embed.js           # Main embeddable script (IIFE)
├── embed.css          # Widget styles (auto-injected)
└── assets/           # Additional chunks (if any)
```

## Testing

### Local Testing

1. **Build the embed script:**
   ```bash
   cd apps/widget
   pnpm build
   ```

2. **Serve the dist folder:**
   ```bash
   npx serve dist
   ```

3. **Open the demo:**
   ```
   http://localhost:3000/embed-demo.html
   ```

### Demo Page

The included `public/embed-demo.html` demonstrates:
- ✅ How to embed the widget
- ✅ Interactive API controls
- ✅ Configuration display
- ✅ Console commands

## Configuration

### Required

```javascript
window.HELVINO_ORG_KEY = "your-org-key";
```

Must be set **before** loading `embed.js`.

### Optional (Future)

```javascript
window.HELVINO_CONFIG = {
  position: "bottom-right",  // Widget position
  offset: { x: 20, y: 20 },  // Position offset
  autoOpen: false,           // Auto-open on load
  autoOpenDelay: 5000,       // Delay before auto-open (ms)
  theme: {
    primaryColor: "#0F5C5C", // Override theme color
  }
};
```

## Error Handling

### Missing Organization Key

If `window.HELVINO_ORG_KEY` is not set:
- Widget will not load
- Console error: `"❌ Helvino Widget: HELVINO_ORG_KEY not found..."`

### Invalid Organization Key

If the org key is invalid:
- Widget loads but doesn't render
- Bootloader returns 404
- Check browser console for errors

### Network Issues

If the API is unreachable:
- Widget loads but remains hidden
- Console shows bootloader error
- Widget will retry on next page load

## Advanced Usage

### Programmatic Open/Close

```javascript
// Open widget when user clicks "Help" button
document.getElementById('help-btn').addEventListener('click', () => {
  Helvino.open();
});

// Close widget after form submission
document.getElementById('contact-form').addEventListener('submit', () => {
  Helvino.close();
});
```

### Check Widget State

```javascript
if (Helvino.isOpen()) {
  console.log('Widget is currently open');
} else {
  console.log('Widget is currently closed');
}
```

### Integration with Analytics

```javascript
// Track widget interactions
window.Helvino.open();
gtag('event', 'widget_open', {
  'event_category': 'engagement',
  'event_label': 'chat_widget'
});
```

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## CDN Deployment

### Recommended CDN Structure

```
https://cdn.helvion.io/
├── embed.js              # Latest version
├── embed.v1.0.0.js      # Versioned (recommended)
└── embed.v1.0.1.js      # New version
```

### Versioned Loading

```html
<!-- Recommended: Use versioned URL -->
<script src="https://cdn.helvion.io/embed.v1.0.0.js"></script>

<!-- Alternative: Always latest (may break) -->
<script src="https://cdn.helvion.io/embed.js"></script>
```

## Security

### Content Security Policy (CSP)

If your site uses CSP, add:

```html
<meta http-equiv="Content-Security-Policy" 
      content="script-src 'self' https://cdn.helvion.io; 
               connect-src 'self' https://api.helvion.io;">
```

### CORS

The widget API endpoint must allow CORS from your domain:

```javascript
// API should respond with:
Access-Control-Allow-Origin: *
// Or specific domain:
Access-Control-Allow-Origin: https://yourdomain.com
```

## Troubleshooting

### Widget doesn't appear

1. Check console for errors
2. Verify `window.HELVINO_ORG_KEY` is set
3. Check Network tab for failed requests
4. Ensure `embed.js` loaded successfully

### Widget appears but is empty

1. Check bootloader API response
2. Verify organization exists in database
3. Check `widgetEnabled` flag in config

### Styling conflicts

The widget uses:
- Isolated CSS (`.helvino-*` classes)
- CSS custom properties (`--primary-color`)
- Fixed positioning (doesn't affect page layout)

If conflicts occur:
- Check for global CSS resets
- Verify z-index isn't overridden
- Inspect widget container in DevTools

## Migration from Direct Import

### Before (Direct Import)

```javascript
import { HelvinoWidget } from '@helvino/widget';

function App() {
  return <HelvinoWidget orgKey="demo" />;
}
```

### After (Embedded Script)

```html
<script>window.HELVINO_ORG_KEY = "demo";</script>
<script src="https://cdn.helvion.io/embed.js"></script>
```

## Next Steps

- [ ] Add CDN deployment pipeline
- [ ] Add versioning strategy
- [ ] Add analytics tracking
- [ ] Add A/B testing support
- [ ] Add custom welcome messages
- [ ] Add widget appearance customization
- [ ] Add auto-open triggers
- [ ] Add visitor identification

## Support

For issues or questions:
- 📧 Email: support@helvion.io
- 📚 Docs: https://docs.helvion.io
- 💬 Chat: Open widget on helvion.io

## License

Proprietary - Helvino.io
