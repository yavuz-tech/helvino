import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Helvion | AI-Powered Chat Solutions",
  description: "Enterprise-grade AI chat platform for modern businesses",
};

/**
 * Inline script that runs BEFORE React hydration.
 *
 * If the user has chosen a non-English locale (stored in helvino_lang cookie),
 * the server-rendered HTML is in English and would flash briefly before React
 * re-renders it in the correct language.
 *
 * This script:
 *   1. Reads the cookie synchronously
 *   2. If locale is NOT "en", hides the body with `opacity:0`
 *   3. Sets `data-i18n-ready="pending"` on <html> so I18nProvider knows to
 *      reveal content after hydration
 *   4. Also sets the correct `lang` attribute immediately
 *
 * The I18nProvider will set `opacity:1` after the first render with the
 * correct locale, so the user never sees English flash.
 *
 * English users see NO delay — body is never hidden for them.
 */
const I18N_BLOCKING_SCRIPT = `
(function(){
  try {
    var m = document.cookie.match(/(?:^|;\\s*)helvino_lang=([^;]*)/);
    var lang = m ? m[1] : null;
    if (lang && lang !== 'en') {
      document.documentElement.lang = lang;
      document.body.style.opacity = '0';
      document.documentElement.dataset.i18nReady = 'pending';
      // Failsafe: if hydration never happens, avoid permanent white screen.
      window.setTimeout(function () {
        if (document.documentElement.dataset.i18nReady === 'pending') {
          document.body.style.opacity = '1';
          document.body.style.transition = 'opacity 0.02s ease-in';
          delete document.documentElement.dataset.i18nReady;
        }
      }, 1200);
    }
  } catch(e) {}
})();
`;
const CHUNK_LOAD_ERROR_RECOVERY = `
(function(){
  window.addEventListener('error', function(e) {
    if (e.message && (e.message.indexOf('ChunkLoadError') !== -1 || e.message.indexOf('Loading chunk') !== -1)) {
      var key = 'helvino_chunk_retry_' + (location.pathname || '/');
      var retries = parseInt(sessionStorage.getItem(key) || '0', 10);
      if (retries < 2) {
        sessionStorage.setItem(key, String(retries + 1));
        window.location.reload();
      }
    }
  });
  window.addEventListener('unhandledrejection', function(e) {
    var msg = (e.reason && (e.reason.message || String(e.reason))) || '';
    if (msg.indexOf('ChunkLoadError') !== -1 || msg.indexOf('Loading chunk') !== -1) {
      var key = 'helvino_chunk_retry_' + (location.pathname || '/');
      var retries = parseInt(sessionStorage.getItem(key) || '0', 10);
      if (retries < 2) {
        sessionStorage.setItem(key, String(retries + 1));
        e.preventDefault();
        window.location.reload();
      }
    }
  });
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning={true}>
      <head suppressHydrationWarning={true} />
      <body className={`${inter.className} antialiased`} suppressHydrationWarning={true}>
        <script dangerouslySetInnerHTML={{ __html: I18N_BLOCKING_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: CHUNK_LOAD_ERROR_RECOVERY }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
