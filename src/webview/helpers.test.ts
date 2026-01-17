import { describe, it, expect } from "vitest";
import { createNonce, escapeHtml, encodeForScript } from "./helpers";

describe("createNonce", () => {
  it("should create a 16-character string", () => {
    const nonce = createNonce();
    expect(nonce).toHaveLength(16);
  });

  it("should only contain alphanumeric characters", () => {
    const nonce = createNonce();
    expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
  });

  it("should create unique nonces", () => {
    const nonces = new Set<string>();
    for (let i = 0; i < 100; i++) {
      nonces.add(createNonce());
    }
    // All should be unique (very high probability)
    expect(nonces.size).toBe(100);
  });
});

describe("escapeHtml", () => {
  it("should escape ampersands", () => {
    expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
  });

  it("should escape less-than signs", () => {
    expect(escapeHtml("foo < bar")).toBe("foo &lt; bar");
  });

  it("should escape greater-than signs", () => {
    expect(escapeHtml("foo > bar")).toBe("foo &gt; bar");
  });

  it("should escape double quotes", () => {
    expect(escapeHtml('foo "bar" baz')).toBe("foo &quot;bar&quot; baz");
  });

  it("should escape single quotes", () => {
    expect(escapeHtml("foo 'bar' baz")).toBe("foo &#39;bar&#39; baz");
  });

  it("should escape all special characters in one string", () => {
    expect(escapeHtml('<script>alert("XSS & \'hacking\'")</script>')).toBe(
      "&lt;script&gt;alert(&quot;XSS &amp; &#39;hacking&#39;&quot;)&lt;/script&gt;"
    );
  });

  it("should return unchanged string with no special characters", () => {
    expect(escapeHtml("Hello World 123")).toBe("Hello World 123");
  });

  it("should handle empty string", () => {
    expect(escapeHtml("")).toBe("");
  });
});

describe("encodeForScript", () => {
  it("should JSON stringify simple values", () => {
    expect(encodeForScript("hello")).toBe('"hello"');
    expect(encodeForScript(123)).toBe("123");
    expect(encodeForScript(true)).toBe("true");
    expect(encodeForScript(null)).toBe("null");
  });

  it("should escape less-than signs to prevent script injection", () => {
    expect(encodeForScript("</script>")).toBe('"\\u003c/script>"');
  });

  it("should handle objects", () => {
    const obj = { name: "test", value: 42 };
    const encoded = encodeForScript(obj);
    expect(encoded).toBe('{"name":"test","value":42}');
  });

  it("should handle arrays", () => {
    const arr = [1, 2, 3];
    const encoded = encodeForScript(arr);
    expect(encoded).toBe("[1,2,3]");
  });

  it("should escape nested script tags in objects", () => {
    const obj = { html: "<script>evil()</script>" };
    const encoded = encodeForScript(obj);
    expect(encoded).not.toContain("</script>");
    expect(encoded).toContain("\\u003c");
  });
});
