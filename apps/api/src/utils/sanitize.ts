import { JSDOM } from "jsdom";
import createDOMPurify from "dompurify";

const window = new JSDOM("").window;
const purify = createDOMPurify(window as unknown as any);

const ALLOWED_TAGS = [
  "b",
  "i",
  "em",
  "strong",
  "a",
  "br",
  "p",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
];

const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeHTML(dirty: string): string {
  return purify.sanitize(dirty || "", {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

export function sanitizePlainText(dirty: string): string {
  return purify.sanitize(dirty || "", {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
}
