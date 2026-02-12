import DOMPurify from "dompurify";

export function sanitizeHTML(dirty: string): string {
  return DOMPurify.sanitize(dirty || "", {
    ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "br", "p", "ul", "ol", "li", "code", "pre"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

export function sanitizePlainText(dirty: string): string {
  return DOMPurify.sanitize(dirty || "", {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
