import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { escapeHtml, escapeAttr, formatAttributeKey, debounce, throttle } from "./utils";

describe("escapeHtml", () => {
  it("should return empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

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

  it("should convert non-strings to strings", () => {
    expect(escapeHtml(123)).toBe("123");
    expect(escapeHtml(true)).toBe("true");
  });
});

describe("escapeAttr", () => {
  it("should return empty string for null/undefined", () => {
    expect(escapeAttr(null)).toBe("");
    expect(escapeAttr(undefined)).toBe("");
  });

  it("should escape backslashes", () => {
    expect(escapeAttr("foo\\bar")).toBe("foo\\\\bar");
  });

  it("should escape single quotes", () => {
    expect(escapeAttr("foo'bar")).toBe("foo\\'bar");
  });

  it("should escape double quotes", () => {
    expect(escapeAttr('foo"bar')).toBe("foo&quot;bar");
  });

  it("should handle multiple escapes", () => {
    expect(escapeAttr("foo\\bar'baz\"qux")).toBe("foo\\\\bar\\'baz&quot;qux");
  });

  it("should convert non-strings to strings", () => {
    expect(escapeAttr(123)).toBe("123");
  });
});

describe("formatAttributeKey", () => {
  it("should replace hyphens with spaces", () => {
    expect(formatAttributeKey("start-name-ref")).toBe("start name ref");
  });

  it("should replace underscores with spaces", () => {
    expect(formatAttributeKey("pipelet_name")).toBe("pipelet name");
  });

  it("should handle mixed separators", () => {
    expect(formatAttributeKey("start-name_ref")).toBe("start name ref");
  });

  it("should handle strings without separators", () => {
    expect(formatAttributeKey("name")).toBe("name");
  });
});

describe("debounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should delay function execution", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should reset timer on subsequent calls", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced();
    vi.advanceTimersByTime(50);
    debounced();
    vi.advanceTimersByTime(50);
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(50);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should pass arguments to the function", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("arg1", "arg2");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });

  it("should use the last arguments when called multiple times", () => {
    const fn = vi.fn();
    const debounced = debounce(fn, 100);

    debounced("first");
    debounced("second");
    debounced("third");
    vi.advanceTimersByTime(100);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith("third");
  });
});

describe("throttle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should execute immediately on first call", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should not execute during throttle period", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    throttled();
    throttled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("should execute again after throttle period", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled();
    vi.advanceTimersByTime(100);
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should execute with last arguments after throttle period", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("first");
    throttled("second");
    throttled("third");

    expect(fn).toHaveBeenCalledWith("first");

    vi.advanceTimersByTime(100);

    // Should have executed with "third" (last args)
    expect(fn).toHaveBeenCalledWith("third");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("should pass arguments correctly", () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 100);

    throttled("arg1", "arg2");
    expect(fn).toHaveBeenCalledWith("arg1", "arg2");
  });
});
