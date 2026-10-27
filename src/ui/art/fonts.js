// Loads the display fonts (Cinzel + Cormorant Garamond) once, at runtime.
// A remote @import inside theme.css would be dropped once Tailwind inlines it
// (it must be the first rule of the final stylesheet), so we inject a <link>.
// Every font stack in theme.css has regal fallbacks, so failure is harmless.

export const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap';

let requested = false;

export function ensureFonts() {
  if (requested) return;
  requested = true;
  if (typeof document === 'undefined' || !document.head) return;
  try {
    if (document.querySelector('link[data-elvia-fonts]')) return;
    const pre1 = document.createElement('link');
    pre1.rel = 'preconnect';
    pre1.href = 'https://fonts.googleapis.com';
    const pre2 = document.createElement('link');
    pre2.rel = 'preconnect';
    pre2.href = 'https://fonts.gstatic.com';
    pre2.crossOrigin = 'anonymous';
    const sheet = document.createElement('link');
    sheet.rel = 'stylesheet';
    sheet.href = FONT_HREF;
    sheet.setAttribute('data-elvia-fonts', '');
    document.head.append(pre1, pre2, sheet);
  } catch {
    /* fonts are cosmetic */
  }
}
