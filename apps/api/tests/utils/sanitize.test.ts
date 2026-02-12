import { describe, expect, it } from "vitest";
import { sanitizeHTML, sanitizePlainText } from "../../src/utils/sanitize";

describe("sanitize utils", () => {
  it("sanitizeHTML strips script tags", () => {
    const dirty = `<p>Hello</p><script>alert("xss")</script>`;
    const clean = sanitizeHTML(dirty);

    expect(clean).toContain("<p>Hello</p>");
    expect(clean).not.toContain("<script>");
    expect(clean).not.toContain("alert(");
  });

  it("sanitizeHTML keeps allowed tags", () => {
    const dirty = `<b>bold</b><i>italic</i><a href="https://helvion.com">link</a><br/>`;
    const clean = sanitizeHTML(dirty);

    expect(clean).toContain("<b>bold</b>");
    expect(clean).toContain("<i>italic</i>");
    expect(clean).toContain('<a href="https://helvion.com">link</a>');
    expect(clean).toContain("<br>");
  });

  it("sanitizeHTML removes dangerous attributes", () => {
    const dirty = `<img src="x" onerror="alert(1)"><a href="#" onclick="evil()">click</a>`;
    const clean = sanitizeHTML(dirty);

    expect(clean).not.toContain("onerror");
    expect(clean).not.toContain("onclick");
  });

  it("sanitizePlainText removes all HTML tags", () => {
    const dirty = `<p>Hi <b>there</b> <a href="https://example.com">friend</a></p>`;
    const clean = sanitizePlainText(dirty);

    expect(clean).toBe("Hi there friend");
  });

  it("sanitizePlainText keeps plain text unchanged", () => {
    const plain = "Just a normal sentence 123 !?";
    expect(sanitizePlainText(plain)).toBe(plain);
  });
});
