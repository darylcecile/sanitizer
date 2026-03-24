import { describe, test, expect } from "bun:test";
import {
  sanitize,
  sanitizeUnsafe,
  Sanitizer,
  BUILT_IN_SAFE_DEFAULT_CONFIG,
} from "../src/index.ts";

// =============================================================================
// Basic sanitization
// =============================================================================

describe("sanitize (safe mode)", () => {
  test("passes through safe HTML unchanged", () => {
    expect(sanitize("<p>Hello <b>world</b></p>")).toBe(
      "<p>Hello <b>world</b></p>",
    );
  });

  test("strips <script> tags", () => {
    expect(sanitize('<script>alert("xss")</script><p>safe</p>')).toBe(
      "<p>safe</p>",
    );
  });

  test("strips <script> tags with attributes", () => {
    expect(sanitize('<script src="evil.js"></script><p>safe</p>')).toBe(
      "<p>safe</p>",
    );
  });

  test("strips inline event handlers", () => {
    expect(sanitize('<div onclick="alert(1)">click</div>')).toBe(
      "<div>click</div>",
    );
  });

  test("strips onmouseover handler", () => {
    expect(sanitize('<span onmouseover="hack()">hover</span>')).toBe(
      "<span>hover</span>",
    );
  });

  test("strips onerror on img", () => {
    expect(sanitize('<img onerror="alert(1)">')).toBe("");
  });

  test("strips <iframe> tags", () => {
    expect(sanitize('<iframe src="evil.html"></iframe><p>ok</p>')).toBe(
      "<p>ok</p>",
    );
  });

  test("strips <object> tags", () => {
    expect(sanitize('<object data="evil.swf"></object><p>ok</p>')).toBe(
      "<p>ok</p>",
    );
  });

  test("strips <embed> tags", () => {
    expect(sanitize('<embed src="evil.swf"><p>ok</p>')).toBe("<p>ok</p>");
  });

  test("strips javascript: URLs from <a> href", () => {
    const result = sanitize('<a href="javascript:alert(1)">click</a>');
    expect(result).toBe("<a>click</a>");
  });

  test("allows safe href on <a>", () => {
    const result = sanitize('<a href="https://example.com">link</a>');
    expect(result).toBe('<a href="https://example.com">link</a>');
  });

  test("strips comments by default", () => {
    expect(sanitize("<!-- comment --><p>text</p>")).toBe("<p>text</p>");
  });

  test("preserves nested safe elements", () => {
    expect(sanitize("<div><p><em>nested</em></p></div>")).toBe(
      "<div><p><em>nested</em></p></div>",
    );
  });

  test("strips unknown elements", () => {
    expect(sanitize("<custom-element>content</custom-element>")).toBe("");
  });

  test("strips style element (not in default allow list)", () => {
    expect(sanitize("<style>body{color:red}</style><p>text</p>")).toBe(
      "<p>text</p>",
    );
  });

  test("strips form elements (not in default allow list)", () => {
    expect(sanitize('<form action="/hack"><input type="text"></form>')).toBe(
      "",
    );
  });

  test("preserves table structure", () => {
    const input =
      "<table><thead><tr><th>H</th></tr></thead><tbody><tr><td>D</td></tr></tbody></table>";
    const result = sanitize(input);
    expect(result).toContain("<table>");
    expect(result).toContain("<th>");
    expect(result).toContain("<td>");
  });

  test("preserves list structure", () => {
    expect(sanitize("<ul><li>item 1</li><li>item 2</li></ul>")).toBe(
      "<ul><li>item 1</li><li>item 2</li></ul>",
    );
  });
});

// =============================================================================
// Unsafe mode
// =============================================================================

describe("sanitizeUnsafe", () => {
  test("allows everything with empty config", () => {
    const result = sanitizeUnsafe(
      '<div onclick="x">text</div>',
    );
    expect(result).toBe('<div onclick="x">text</div>');
  });

  test("allows script tags with empty config", () => {
    const result = sanitizeUnsafe(
      "<script>alert(1)</script><p>ok</p>",
    );
    expect(result).toContain("<script>");
    expect(result).toContain("<p>ok</p>");
  });

  test("allows comments with empty config", () => {
    const result = sanitizeUnsafe("<!-- comment --><p>text</p>");
    expect(result).toBe("<!-- comment --><p>text</p>");
  });
});

// =============================================================================
// Custom configurations
// =============================================================================

describe("sanitize with custom config", () => {
  test("elements allow-list removes disallowed elements and their children", () => {
    // Per spec: if an element is not allowed, it and its subtree are removed
    const result = sanitize("<div><p>text</p><span>more</span></div>", {
      sanitizer: { elements: ["p"] },
    });
    expect(result).toBe("");
  });

  test("elements allow-list with replaceWithChildrenElements", () => {
    // Use replaceWithChildrenElements to unwrap disallowed elements
    const result = sanitize("<div><p>text</p><span>more</span></div>", {
      sanitizer: {
        elements: ["p"],
        attributes: [],
        replaceWithChildrenElements: ["div"],
      },
    });
    expect(result).toBe("<p>text</p>");
  });

  test("removeElements", () => {
    const result = sanitize("<div><p>text</p><span>more</span></div>", {
      sanitizer: { removeElements: ["span"] },
      safe: false,
    });
    expect(result).toBe("<div><p>text</p></div>");
  });

  test("replaceWithChildrenElements", () => {
    const result = sanitize("<div><b>bold</b> text</div>", {
      sanitizer: {
        removeElements: [],
        removeAttributes: [],
        replaceWithChildrenElements: ["b"],
      },
      safe: false,
    });
    expect(result).toBe("<div>bold text</div>");
  });

  test("attributes allow-list", () => {
    const result = sanitize(
      '<div class="x" id="y" title="z">text</div>',
      {
        sanitizer: { elements: ["div"], attributes: ["class"] },
      },
    );
    expect(result).toBe('<div class="x">text</div>');
  });

  test("removeAttributes", () => {
    const result = sanitize(
      '<div class="x" id="y">text</div>',
      {
        sanitizer: { removeElements: [], removeAttributes: ["id"] },
        safe: false,
      },
    );
    expect(result).toBe('<div class="x">text</div>');
  });

  test("comments: true preserves comments", () => {
    const result = sanitize("<!-- hello --><p>text</p>", {
      sanitizer: { elements: ["p"], attributes: [], comments: true },
    });
    expect(result).toBe("<!-- hello --><p>text</p>");
  });

  test("dataAttributes: true allows data-* attributes", () => {
    const result = sanitize(
      '<div data-value="42">text</div>',
      {
        sanitizer: {
          elements: ["div"],
          attributes: [],
          dataAttributes: true,
        },
      },
    );
    expect(result).toBe('<div data-value="42">text</div>');
  });
});

// =============================================================================
// Sanitizer class
// =============================================================================

describe("Sanitizer class", () => {
  test("constructor with default preset", () => {
    const s = new Sanitizer("default");
    const config = s.get();
    expect(config.elements).toBeDefined();
    expect(config.attributes).toBeDefined();
  });

  test("constructor with no args uses default", () => {
    const s = new Sanitizer();
    const config = s.get();
    expect(config.elements).toBeDefined();
  });

  test("constructor with empty config", () => {
    const s = new Sanitizer({});
    const config = s.get();
    expect(config.removeElements).toBeDefined();
    expect(config.removeAttributes).toBeDefined();
  });

  test("constructor throws on invalid config", () => {
    expect(() => {
      new Sanitizer({
        elements: ["div"],
        removeElements: ["div"],
      } as any);
    }).toThrow(TypeError);
  });

  test("allowElement adds to allow-list", () => {
    const s = new Sanitizer({ elements: ["div"], attributes: [] });
    expect(s.allowElement("p")).toBe(true);
    const config = s.get();
    const names = config.elements?.map((e: any) =>
      typeof e === "string" ? e : e.name,
    );
    expect(names).toContain("p");
  });

  test("removeElement removes from allow-list", () => {
    const s = new Sanitizer({ elements: ["div", "p"], attributes: [] });
    expect(s.removeElement("p")).toBe(true);
    const config = s.get();
    const names = config.elements?.map((e: any) =>
      typeof e === "string" ? e : e.name,
    );
    expect(names).not.toContain("p");
  });

  test("replaceElementWithChildren", () => {
    const s = new Sanitizer({ elements: ["div", "b"], attributes: [] });
    expect(s.replaceElementWithChildren("b")).toBe(true);
    const config = s.get();
    const replaceNames = config.replaceWithChildrenElements?.map((e: any) =>
      typeof e === "string" ? e : e.name,
    );
    expect(replaceNames).toContain("b");
  });

  test("replaceElementWithChildren rejects html", () => {
    const s = new Sanitizer({ elements: ["html"], attributes: [] });
    expect(s.replaceElementWithChildren("html")).toBe(false);
  });

  test("allowAttribute adds to allow-list", () => {
    const s = new Sanitizer({ elements: [], attributes: ["class"] });
    expect(s.allowAttribute("id")).toBe(true);
    const config = s.get();
    const names = config.attributes?.map((a: any) =>
      typeof a === "string" ? a : a.name,
    );
    expect(names).toContain("id");
  });

  test("removeAttribute removes from allow-list", () => {
    const s = new Sanitizer({
      elements: [],
      attributes: ["class", "id"],
    });
    expect(s.removeAttribute("id")).toBe(true);
    const config = s.get();
    const names = config.attributes?.map((a: any) =>
      typeof a === "string" ? a : a.name,
    );
    expect(names).not.toContain("id");
  });

  test("setComments", () => {
    // Constructor with allowCommentsAndDataAttributes=true defaults comments to true
    const s = new Sanitizer({ elements: [], attributes: [] });
    expect(s.get().comments).toBe(true);
    expect(s.setComments(false)).toBe(true);
    expect(s.get().comments).toBe(false);
    expect(s.setComments(false)).toBe(false); // already set
  });

  test("setDataAttributes", () => {
    const s = new Sanitizer({ elements: [], attributes: [] });
    expect(s.get().dataAttributes).toBe(true);
    expect(s.setDataAttributes(false)).toBe(true);
    expect(s.get().dataAttributes).toBe(false);
    expect(s.setDataAttributes(false)).toBe(false); // already set
  });

  test("removeUnsafe removes script elements", () => {
    const s = new Sanitizer({});
    s.removeUnsafe();
    const config = s.get();
    const removeNames = config.removeElements?.map((e: any) =>
      typeof e === "string" ? e : e.name,
    );
    expect(removeNames).toContain("script");
    expect(removeNames).toContain("iframe");
  });

  test("get() returns sorted config", () => {
    const s = new Sanitizer({
      elements: ["div", "a", "p"],
      attributes: ["id", "class"],
    });
    const config = s.get();
    const names = config.elements?.map((e: any) =>
      typeof e === "string" ? e : e.name,
    );
    const sortedNames = [...(names ?? [])].sort();
    expect(names).toEqual(sortedNames);
  });

  test("using Sanitizer instance with sanitize()", () => {
    const s = new Sanitizer({
      elements: ["div", "p", "b"],
      attributes: [],
    });
    const result = sanitize("<div><p><b>bold</b></p></div>", {
      sanitizer: s,
    });
    expect(result).toBe("<div><p><b>bold</b></p></div>");
  });
});

// =============================================================================
// XSS attack vectors
// =============================================================================

describe("XSS attack vectors", () => {
  test("nested script in div", () => {
    expect(
      sanitize("<div><script>alert(1)</script></div>"),
    ).toBe("<div></div>");
  });

  test("svg script injection", () => {
    expect(
      sanitize('<svg><script>alert(1)</script></svg>'),
    ).not.toContain("<script>");
  });

  test("img with onerror", () => {
    expect(sanitize('<img src="x" onerror="alert(1)">')).toBe("");
  });

  test("a with javascript: href", () => {
    expect(sanitize('<a href="javascript:alert(1)">click</a>')).toBe(
      "<a>click</a>",
    );
  });

  test("a with javascript: href (mixed case)", () => {
    expect(sanitize('<a href="JaVaScRiPt:alert(1)">click</a>')).toBe(
      "<a>click</a>",
    );
  });

  test("a with javascript: href (whitespace)", () => {
    expect(sanitize('<a href="  javascript:alert(1)">click</a>')).toBe(
      "<a>click</a>",
    );
  });

  test("event handler with various events", () => {
    const events = [
      "onfocus",
      "onblur",
      "onload",
      "onerror",
      "onsubmit",
      "onreset",
    ];
    for (const event of events) {
      const result = sanitize(`<div ${event}="alert(1)">text</div>`);
      expect(result).toBe("<div>text</div>");
    }
  });

  test("iframe with srcdoc", () => {
    expect(
      sanitize(
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      ),
    ).toBe("");
  });

  test("object tag", () => {
    expect(sanitize('<object data="evil.swf"></object>')).toBe("");
  });

  test("embed tag", () => {
    expect(sanitize('<embed src="evil.swf">')).toBe("");
  });

  test("base tag with javascript href", () => {
    expect(sanitize('<base href="javascript:alert(1)">')).toBe("");
  });

  test("meta refresh", () => {
    expect(
      sanitize(
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      ),
    ).toBe("");
  });

  test("style tag injection", () => {
    expect(
      sanitize(
        "<style>body{background:url('javascript:alert(1)')}</style>",
      ),
    ).toBe("");
  });
});

// =============================================================================
// Parser edge cases
// =============================================================================

describe("HTML parser edge cases", () => {
  test("handles self-closing tags", () => {
    expect(sanitize("<br>")).toBe("<br>");
    expect(sanitize("<br/>")).toBe("<br>");
    expect(sanitize("<hr>")).toBe("<hr>");
  });

  test("handles void elements", () => {
    expect(sanitize("<br><p>text</p>")).toBe("<br><p>text</p>");
  });

  test("handles unclosed tags", () => {
    const result = sanitize("<p>text");
    expect(result).toContain("<p>");
    expect(result).toContain("text");
  });

  test("handles nested tags", () => {
    expect(
      sanitize("<div><p><span>deep</span></p></div>"),
    ).toBe("<div><p><span>deep</span></p></div>");
  });

  test("handles attributes with special characters", () => {
    const result = sanitize('<a href="https://example.com?a=1&amp;b=2">link</a>');
    expect(result).toContain("href=");
    expect(result).toContain("example.com");
  });

  test("handles empty string", () => {
    expect(sanitize("")).toBe("");
  });

  test("handles plain text", () => {
    expect(sanitize("just text")).toBe("just text");
  });

  test("handles text with angle brackets escaped", () => {
    expect(sanitize("1 &lt; 2")).toBe("1 &lt; 2");
  });

  test("handles multiple root elements", () => {
    expect(sanitize("<p>one</p><p>two</p>")).toBe(
      "<p>one</p><p>two</p>",
    );
  });

  test("handles comments", () => {
    const result = sanitizeUnsafe("<!-- test --><p>text</p>");
    expect(result).toContain("<!-- test -->");
  });

  test("handles boolean attributes", () => {
    const result = sanitize('<ol reversed=""><li>item</li></ol>');
    expect(result).toContain("reversed");
  });
});

// =============================================================================
// Serializer
// =============================================================================

describe("serializer", () => {
  test("escapes text content", () => {
    const result = sanitize("<p>1 < 2 & 3 > 0</p>");
    expect(result).toBe("<p>1 &lt; 2 &amp; 3 &gt; 0</p>");
  });

  test("escapes attribute values", () => {
    const result = sanitize('<a href="https://example.com?a=1&b=2">link</a>');
    expect(result).toContain("&amp;");
  });
});

// =============================================================================
// Config validation
// =============================================================================

describe("config validation", () => {
  test("rejects both elements and removeElements", () => {
    expect(() => {
      new Sanitizer({
        elements: ["div"],
        removeElements: ["script"],
      } as any);
    }).toThrow(TypeError);
  });

  test("rejects both attributes and removeAttributes", () => {
    expect(() => {
      new Sanitizer({
        elements: [],
        attributes: ["class"],
        removeAttributes: ["id"],
      } as any);
    }).toThrow(TypeError);
  });

  test("accepts empty config (normalized to remove-lists)", () => {
    const s = new Sanitizer({});
    const config = s.get();
    expect(config.removeElements).toBeDefined();
    expect(config.removeAttributes).toBeDefined();
  });
});
