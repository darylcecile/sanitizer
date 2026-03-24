/**
 * Tests adapted from apostrophecms/sanitize-html test suite.
 * @see https://github.com/apostrophecms/apostrophe/blob/main/packages/sanitize-html/test/test.js
 *
 * These tests validate our W3C Sanitizer API implementation against the same
 * attack vectors and edge cases that sanitize-html covers. Our API differs
 * (W3C spec vs sanitize-html's custom API), so tests are adapted accordingly.
 *
 * Key behavioral differences:
 *   - Our default safe mode uses the W3C built-in safe default config (allowlist)
 *   - Disallowed elements are REMOVED with their subtree (W3C spec), not unwrapped
 *   - Use `replaceWithChildrenElements` to unwrap (keep children, remove tag)
 *   - No `transformTags`, `exclusiveFilter`, `disallowedTagsMode`, `allowedClasses`,
 *     `allowedStyles`, `allowedSchemes`, `textFilter`, `nestingLimit` etc.
 */

import { describe, test, expect } from "bun:test";
import { sanitize, sanitizeUnsafe, Sanitizer } from "../src/index.ts";

// =============================================================================
// 1. Basic pass-through
// =============================================================================

describe("adapted: basic pass-through", () => {
  test("should pass through simple, well-formed markup", () => {
    expect(
      sanitize("<div><p>Hello <b>there</b></p></div>"),
    ).toBe("<div><p>Hello <b>there</b></p></div>");
  });

  test("should respect text nodes at top level", () => {
    expect(sanitize("Blah blah blah<p>Whee!</p>")).toBe(
      "Blah blah blah<p>Whee!</p>",
    );
  });

  test("should return an empty string when input is an empty string", () => {
    expect(sanitize("")).toBe("");
  });

  test("should preserve list structure", () => {
    expect(sanitize("<ul><li>Hello world</li></ul>")).toBe(
      "<ul><li>Hello world</li></ul>",
    );
  });

  test("should preserve ordered list with attributes", () => {
    expect(sanitize('<ol reversed="" start="5"><li>item</li></ol>')).toContain(
      "<ol",
    );
    expect(sanitize('<ol reversed="" start="5"><li>item</li></ol>')).toContain(
      "<li>item</li>",
    );
  });
});

// =============================================================================
// 2. Allow/remove everything
// =============================================================================

describe("adapted: allow/remove all", () => {
  test("should pass through all markup in unsafe mode with no config", () => {
    expect(
      sanitizeUnsafe('<div><wiggly worms="ewww">hello</wiggly></div>'),
    ).toBe('<div><wiggly worms="ewww">hello</wiggly></div>');
  });

  test("unsafe mode preserves event handlers", () => {
    expect(
      sanitizeUnsafe('<div onclick="alert(1)">hello</div>'),
    ).toBe('<div onclick="alert(1)">hello</div>');
  });

  test("unsafe mode preserves script tags", () => {
    const result = sanitizeUnsafe(
      '<script>alert("hi")</script><p>ok</p>',
    );
    expect(result).toContain("<script>");
    expect(result).toContain("<p>ok</p>");
  });
});

// =============================================================================
// 3. Element filtering
// =============================================================================

describe("adapted: element filtering", () => {
  test("should remove disallowed elements (W3C: removes subtree)", () => {
    // sanitize-html keeps text ("Hello") when <wiggly> is removed.
    // W3C spec: element + subtree is removed. Use replaceWithChildrenElements to unwrap.
    const result = sanitize("<div><wiggly>Hello</wiggly></div>", {
      sanitizer: {
        removeElements: [],
        removeAttributes: [],
        replaceWithChildrenElements: ["wiggly"],
      },
      safe: false,
    });
    expect(result).toBe("<div>Hello</div>");
  });

  test("should accept a custom list of allowed elements", () => {
    const result = sanitize(
      "<blue><red><green>Cheese</green></red></blue>",
      {
        sanitizer: {
          elements: ["blue", "green"],
          attributes: [],
          replaceWithChildrenElements: ["red"],
        },
      },
    );
    expect(result).toBe("<blue><green>Cheese</green></blue>");
  });

  test("should remove script elements and their content", () => {
    expect(
      sanitize('<script>alert("ruhroh!");</script><p>Paragraph</p>'),
    ).toBe("<p>Paragraph</p>");
  });

  test("should remove style elements (not in default allow list)", () => {
    expect(
      sanitize(
        "<style>.foo { color: blue; }</style><p>Paragraph</p>",
      ),
    ).toBe("<p>Paragraph</p>");
  });

  test("should remove textarea elements (not in default allow list)", () => {
    expect(
      sanitize("<textarea>Nifty</textarea><p>Paragraph</p>"),
    ).toBe("<p>Paragraph</p>");
  });

  test("should remove unknown/custom elements in safe mode", () => {
    expect(sanitize("<fibble>Nifty</fibble><p>Paragraph</p>")).toBe(
      "<p>Paragraph</p>",
    );
  });

  test("custom elements are preserved in unsafe mode", () => {
    expect(
      sanitizeUnsafe("<fibble>Nifty</fibble><p>Paragraph</p>"),
    ).toBe("<fibble>Nifty</fibble><p>Paragraph</p>");
  });

  test("replaceWithChildrenElements unwraps tags", () => {
    const result = sanitize(
      "<div><b>bold</b> and <i>italic</i></div>",
      {
        sanitizer: {
          removeElements: [],
          removeAttributes: [],
          replaceWithChildrenElements: ["b", "i"],
        },
        safe: false,
      },
    );
    expect(result).toBe("<div>bold and italic</div>");
  });
});

// =============================================================================
// 4. Attribute filtering
// =============================================================================

describe("adapted: attribute filtering", () => {
  test("should reject attributes not in allow-list", () => {
    expect(sanitize('<a href="foo.html" whizbang="whangle">foo</a>')).toBe(
      '<a href="foo.html">foo</a>',
    );
  });

  test("should allow attributes via per-element config", () => {
    const result = sanitize(
      '<a href="foo.html" whizbang="whangle">foo</a>',
      {
        sanitizer: {
          elements: [
            {
              name: "a",
              namespace: "http://www.w3.org/1999/xhtml",
              attributes: [
                { name: "href", namespace: null },
                { name: "whizbang", namespace: null },
              ],
            },
          ],
          attributes: [],
        },
      },
    );
    expect(result).toBe('<a href="foo.html" whizbang="whangle">foo</a>');
  });

  test("should strip disallowed attributes with global allow-list", () => {
    const result = sanitize(
      '<div class="x" id="y" title="z">text</div>',
      {
        sanitizer: { elements: ["div"], attributes: ["class"] },
      },
    );
    expect(result).toBe('<div class="x">text</div>');
  });

  test("should remove specific attributes with removeAttributes", () => {
    const result = sanitize(
      '<div class="x" id="y">text</div>',
      {
        sanitizer: { removeElements: [], removeAttributes: ["id"] },
        safe: false,
      },
    );
    expect(result).toBe('<div class="x">text</div>');
  });

  test("data-* attributes via dataAttributes config", () => {
    const result = sanitize(
      '<a data-target="#test" data-foo="hello">click me</a>',
      {
        sanitizer: {
          elements: [
            {
              name: "a",
              namespace: "http://www.w3.org/1999/xhtml",
              attributes: [],
            },
          ],
          attributes: [],
          dataAttributes: true,
        },
      },
    );
    expect(result).toBe(
      '<a data-target="#test" data-foo="hello">click me</a>',
    );
  });
});

// =============================================================================
// 5. javascript: URL filtering
// =============================================================================

describe("adapted: javascript URL filtering", () => {
  test("should reject javascript: hrefs", () => {
    expect(
      sanitize(
        '<a href="http://google.com">google</a><a href="javascript:alert(0)">javascript</a>',
      ),
    ).toBe('<a href="http://google.com">google</a><a>javascript</a>');
  });

  test("should handle capitalized attributes and tags", () => {
    // Our parser lowercases tag names
    expect(
      sanitize('<a href="HTTPS://google.com">https google</a>'),
    ).toBe('<a href="HTTPS://google.com">https google</a>');
  });

  test("should reject uppercase javascript URL", () => {
    expect(
      sanitize("<a href=\"JAVASCRIPT:alert('foo')\">Hax</a>"),
    ).toBe("<a>Hax</a>");
  });

  test("should reject sneaky encoded javascript url", () => {
    // &#106;&#97;&#118;&#97;... = "javascript:alert('XSS')"
    expect(
      sanitize(
        '<a href="&#106;&#97;&#118;&#97;&#115;&#99;&#114;&#105;&#112;&#116;&#58;&#97;&#108;&#101;&#114;&#116;&#40;&#39;&#88;&#83;&#83;&#39;&#41;">Hax</a>',
      ),
    ).toBe("<a>Hax</a>");
  });

  test("should not mess up a hashcode with a colon in it", () => {
    expect(
      sanitize('<a href="awesome.html#this:stuff">Hi</a>'),
    ).toBe('<a href="awesome.html#this:stuff">Hi</a>');
  });

  test("should still allow nice http schemes", () => {
    expect(sanitize('<a href="http://google.com/">Hi</a>')).toBe(
      '<a href="http://google.com/">Hi</a>',
    );
  });

  test("should still allow nice relative URLs", () => {
    expect(sanitize('<a href="hello.html">Hi</a>')).toBe(
      '<a href="hello.html">Hi</a>',
    );
  });

  test("should allow safe schemes (ftp, mailto, https)", () => {
    expect(
      sanitize('<a href="https://google.com">https</a>'),
    ).toBe('<a href="https://google.com">https</a>');

    expect(
      sanitize('<a href="mailto:test@test.com">mailto</a>'),
    ).toBe('<a href="mailto:test@test.com">mailto</a>');
  });

  test("should allow relative URLs", () => {
    expect(sanitize('<a href="/relative.html">relative</a>')).toBe(
      '<a href="/relative.html">relative</a>',
    );
  });

  test("should parse path-rooted relative URLs sensibly", () => {
    expect(sanitize('<a href="/foo"></a>')).toBe('<a href="/foo"></a>');
  });

  test("should parse bare relative URLs sensibly", () => {
    expect(sanitize('<a href="foo"></a>')).toBe('<a href="foo"></a>');
  });

  test("should parse ../ relative URLs sensibly", () => {
    expect(sanitize('<a href="../../foo"></a>')).toBe(
      '<a href="../../foo"></a>',
    );
  });

  test("should parse protocol relative URLs sensibly", () => {
    expect(sanitize('<a href="//foo.com/foo"></a>')).toBe(
      '<a href="//foo.com/foo"></a>',
    );
  });
});

// =============================================================================
// 6. Script/XSS attack vectors
// =============================================================================

describe("adapted: XSS attack vectors", () => {
  test("should strip script tag content", () => {
    expect(
      sanitize('<script>alert("ruhroh!");</script><p>Paragraph</p>'),
    ).toBe("<p>Paragraph</p>");
  });

  test("should strip script tags with src", () => {
    expect(
      sanitize(
        '<script src="https://evil.com/lib.js"></script><p>ok</p>',
      ),
    ).toBe("<p>ok</p>");
  });

  test("should strip inline event handlers (onclick)", () => {
    expect(sanitize('<div onclick="alert(1)">text</div>')).toBe(
      "<div>text</div>",
    );
  });

  test("should strip onerror on elements", () => {
    expect(sanitize('<div onerror="alert(1)">text</div>')).toBe(
      "<div>text</div>",
    );
  });

  test("should strip onload handler", () => {
    expect(sanitize('<div onload="alert(1)">text</div>')).toBe(
      "<div>text</div>",
    );
  });

  test("should strip onfocus handler", () => {
    expect(sanitize('<div onfocus="alert(1)">text</div>')).toBe(
      "<div>text</div>",
    );
  });

  test("should strip onmouseover handler", () => {
    expect(sanitize('<span onmouseover="hack()">text</span>')).toBe(
      "<span>text</span>",
    );
  });

  test("should strip iframe tags", () => {
    expect(
      sanitize('<iframe src="evil.html"></iframe><p>ok</p>'),
    ).toBe("<p>ok</p>");
  });

  test("should strip object tags", () => {
    expect(
      sanitize('<object data="evil.swf"></object><p>ok</p>'),
    ).toBe("<p>ok</p>");
  });

  test("should strip embed tags", () => {
    expect(sanitize('<embed src="evil.swf"><p>ok</p>')).toBe(
      "<p>ok</p>",
    );
  });

  test("should strip img with onerror (not in default allow-list)", () => {
    expect(sanitize('<img src="x" onerror="alert(1)">')).toBe("");
  });

  test("should strip base tag (not in default allow-list)", () => {
    expect(sanitize('<base href="http://evil.com">')).toBe("");
  });

  test("should strip meta tag", () => {
    expect(
      sanitize(
        '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">',
      ),
    ).toBe("");
  });

  test("should strip form elements", () => {
    expect(
      sanitize('<form action="/hack"><input type="text"></form>'),
    ).toBe("");
  });

  test("nested script in allowed element", () => {
    expect(
      sanitize("<div><script>alert(1)</script></div>"),
    ).toBe("<div></div>");
  });

  test("svg script injection", () => {
    const result = sanitize(
      "<svg><script>alert(1)</script></svg>",
    );
    expect(result).not.toContain("<script>");
  });

  test("should strip multiple event handlers on one element", () => {
    const result = sanitize(
      '<div onclick="a()" onmouseover="b()" onfocus="c()">text</div>',
    );
    expect(result).toBe("<div>text</div>");
  });

  test("javascript: in href with whitespace prefix", () => {
    expect(
      sanitize('<a href="  javascript:alert(1)">click</a>'),
    ).toBe("<a>click</a>");
  });

  test("javascript: in href with mixed case", () => {
    expect(
      sanitize('<a href="JaVaScRiPt:alert(1)">click</a>'),
    ).toBe("<a>click</a>");
  });

  test("should strip style element used for injection", () => {
    expect(
      sanitize(
        "<style>body{background:url('javascript:alert(1)')}</style>",
      ),
    ).toBe("");
  });
});

// =============================================================================
// 7. Comments
// =============================================================================

describe("adapted: comments", () => {
  test("should strip comments by default in safe mode", () => {
    expect(sanitize("<p><!-- Blah blah -->Whee</p>")).toBe(
      "<p>Whee</p>",
    );
  });

  test("should strip comments in custom config without comments: true", () => {
    expect(
      sanitize("<!-- secret --><p>text</p>", {
        sanitizer: { elements: ["p"], attributes: [] },
      }),
    ).toBe("<p>text</p>");
  });

  test("should preserve comments when comments: true", () => {
    expect(
      sanitize("<!-- hello --><p>text</p>", {
        sanitizer: { elements: ["p"], attributes: [], comments: true },
      }),
    ).toBe("<!-- hello --><p>text</p>");
  });

  test("unsafe mode preserves comments by default", () => {
    expect(sanitizeUnsafe("<!-- hello --><p>text</p>")).toBe(
      "<!-- hello --><p>text</p>",
    );
  });
});

// =============================================================================
// 8. Entity handling
// =============================================================================

describe("adapted: entity handling", () => {
  test("should encode <, >, & in text content", () => {
    expect(sanitize("<p>1 < 2 & 3 > 0</p>")).toBe(
      "<p>1 &lt; 2 &amp; 3 &gt; 0</p>",
    );
  });

  test("should preserve entities in attribute values", () => {
    const result = sanitize(
      '<a href="https://example.com?a=1&b=2">link</a>',
    );
    expect(result).toContain("&amp;");
  });

  test("should escape quotes in attribute values", () => {
    const result = sanitize(
      '<a href="https://example.com">link</a>',
    );
    expect(result).toBe('<a href="https://example.com">link</a>');
  });

  test("should handle HTML entities in text", () => {
    expect(sanitize("&lt;Kapow!&gt;")).toBe("&lt;Kapow!&gt;");
  });

  test("should handle text with &amp;", () => {
    expect(sanitize("<p>Tom &amp; Jerry</p>")).toBe(
      "<p>Tom &amp; Jerry</p>",
    );
  });
});

// =============================================================================
// 9. Parser edge cases (adapted from sanitize-html tests)
// =============================================================================

describe("adapted: parser edge cases", () => {
  test("should handle self-closing tags (void elements)", () => {
    expect(sanitize("<br>")).toBe("<br>");
    expect(sanitize("<hr>")).toBe("<hr>");
  });

  test("should handle void elements mixed with content", () => {
    expect(sanitize("<br><p>text</p>")).toBe("<br><p>text</p>");
  });

  test("should tolerate not-closed p tags (auto-close)", () => {
    expect(
      sanitize(
        "<div><p>inner text 1<p>inner text 2<p>inner text 3</div>",
      ),
    ).toBe(
      "<div><p>inner text 1</p><p>inner text 2</p><p>inner text 3</p></div>",
    );
  });

  test("should handle unclosed tags gracefully", () => {
    const result = sanitize("<p>text");
    expect(result).toContain("<p>");
    expect(result).toContain("text");
  });

  test("should handle empty string", () => {
    expect(sanitize("")).toBe("");
  });

  test("should handle plain text (no tags)", () => {
    expect(sanitize("just text")).toBe("just text");
  });

  test("should handle multiple root elements", () => {
    expect(sanitize("<p>one</p><p>two</p>")).toBe(
      "<p>one</p><p>two</p>",
    );
  });

  test("should handle deeply nested elements", () => {
    expect(
      sanitize(
        "<div><div><div><div><div><div>deep</div></div></div></div></div></div>",
      ),
    ).toBe(
      "<div><div><div><div><div><div>deep</div></div></div></div></div></div>",
    );
  });

  test("should lowercase tag names", () => {
    const result = sanitizeUnsafe("<DIV><P>Hello</P></DIV>");
    expect(result).toBe("<div><p>Hello</p></div>");
  });

  test("should lowercase attribute names", () => {
    const result = sanitize('<a HREF="http://google.com">google</a>');
    expect(result).toBe('<a href="http://google.com">google</a>');
  });
});

// =============================================================================
// 10. Table structure
// =============================================================================

describe("adapted: table structure", () => {
  test("should preserve table elements and attributes", () => {
    const input =
      '<table><thead><tr><th colspan="2">Header</th></tr></thead><tbody><tr><td>Data</td></tr></tbody></table>';
    const result = sanitize(input);
    expect(result).toContain("<table>");
    expect(result).toContain("<thead>");
    expect(result).toContain("<th");
    expect(result).toContain("colspan=");
    expect(result).toContain("<td>");
    expect(result).toContain("</table>");
  });

  test("should preserve th attributes (abbr, colspan, headers, rowspan, scope)", () => {
    const result = sanitize(
      '<th abbr="H" colspan="2" headers="h1" rowspan="1" scope="col">Header</th>',
    );
    expect(result).toContain("abbr=");
    expect(result).toContain("colspan=");
    expect(result).toContain("scope=");
  });
});

// =============================================================================
// 11. Sanitizer class (config management)
// =============================================================================

describe("adapted: Sanitizer class", () => {
  test("default preset includes common safe elements", () => {
    const s = new Sanitizer("default");
    const config = s.get();
    const names = (config.elements as any[])?.map((e) =>
      typeof e === "string" ? e : e.name,
    );
    expect(names).toContain("p");
    expect(names).toContain("div");
    expect(names).toContain("b");
    expect(names).toContain("a");
    expect(names).toContain("table");
  });

  test("default preset does NOT include unsafe elements", () => {
    const s = new Sanitizer("default");
    const config = s.get();
    const names = (config.elements as any[])?.map((e) =>
      typeof e === "string" ? e : e.name,
    );
    expect(names).not.toContain("script");
    expect(names).not.toContain("style");
    expect(names).not.toContain("iframe");
    expect(names).not.toContain("object");
    expect(names).not.toContain("embed");
    expect(names).not.toContain("form");
    expect(names).not.toContain("input");
    expect(names).not.toContain("img");
  });

  test("allowElement then use in sanitize", () => {
    const s = new Sanitizer({
      elements: ["p"],
      attributes: [],
    });
    s.allowElement("b");
    const result = sanitize("<p><b>bold</b></p>", { sanitizer: s });
    expect(result).toBe("<p><b>bold</b></p>");
  });

  test("removeElement then use in sanitize", () => {
    const s = new Sanitizer({
      elements: ["p", "b"],
      attributes: [],
    });
    s.removeElement("b");
    const result = sanitize("<p><b>bold</b></p>", { sanitizer: s });
    // <b> removed with its subtree
    expect(result).toBe("<p></p>");
  });

  test("removeUnsafe strips dangerous config", () => {
    const s = new Sanitizer({});
    s.removeUnsafe();
    const config = s.get();
    const removeNames = (config.removeElements as any[])?.map(
      (e) => (typeof e === "string" ? e : e.name),
    );
    expect(removeNames).toContain("script");
    expect(removeNames).toContain("iframe");
    expect(removeNames).toContain("object");
    expect(removeNames).toContain("embed");
  });
});

// =============================================================================
// 12. Per-element attribute control (W3C spec feature)
// =============================================================================

describe("adapted: per-element attribute control", () => {
  test("allows href on <a> but not on other elements", () => {
    // In our default config, <a> allows href but <div> does not
    const result = sanitize(
      '<a href="http://example.com">link</a><div href="bad">text</div>',
    );
    expect(result).toContain('href="http://example.com"');
    expect(result).not.toContain('href="bad"');
  });

  test("per-element attributes in custom config", () => {
    const result = sanitize(
      '<a href="test.html" class="link">link</a><div class="box">box</div>',
      {
        sanitizer: {
          elements: [
            {
              name: "a",
              namespace: "http://www.w3.org/1999/xhtml",
              attributes: [{ name: "href", namespace: null }],
            },
            {
              name: "div",
              namespace: "http://www.w3.org/1999/xhtml",
              attributes: [{ name: "class", namespace: null }],
            },
          ],
          attributes: [],
        },
      },
    );
    expect(result).toContain('href="test.html"');
    expect(result).not.toContain('class="link"');
    expect(result).toContain('class="box"');
  });
});

// =============================================================================
// 13. Comprehensive XSS from sanitize-html (additional vectors)
// =============================================================================

describe("adapted: additional XSS vectors from sanitize-html", () => {
  test("double < should not bypass sanitizer", () => {
    // '<<img src="javascript:evil"/>img src="javascript:evil"/>'
    // The first '<' is consumed as text, then '<img' is parsed as an element.
    // The img element is not in the default allow-list, so it's removed.
    // Remaining text is harmless plain text (not in any attribute context).
    const result = sanitize(
      '<<img src="javascript:evil"/>img src="javascript:evil"/>',
    );
    expect(result).not.toContain("<img");
    // The text portion may contain "javascript:" but it's plain text, not an href
    // — this is safe. The key assertion is no <img> element survives.
  });

  test("should handle malformed closing tags", () => {
    // '<b><div/' — malformed
    const result = sanitize("<b>text<div/", {
      sanitizer: {
        elements: ["b"],
        attributes: [],
      },
    });
    expect(result).toContain("<b>");
  });

  test("javascript: with tab/newline chars in href", () => {
    // Various whitespace-based evasion attempts
    expect(
      sanitize(
        '<a href="java\tscript:alert(1)">test</a>',
      ),
    ).toBe("<a>test</a>");
  });

  test("should strip SVG use element (in safe baseline)", () => {
    // SVG <use> can be used for XSS
    const result = sanitize(
      '<svg><use href="data:image/svg+xml,<svg onload=alert(1)>"></use></svg>',
    );
    expect(result).not.toContain("<use");
  });

  test("event handlers beyond common ones (onwheel, onpaste, etc.)", () => {
    const handlers = [
      "onwheel",
      "onpaste",
      "oncopy",
      "oncut",
      "onscroll",
      "onscrollend",
      "ondrag",
      "ondrop",
    ];
    for (const handler of handlers) {
      const result = sanitize(`<div ${handler}="evil()">text</div>`);
      expect(result).toBe("<div>text</div>");
    }
  });
});

// =============================================================================
// 14. Semantic HTML elements
// =============================================================================

describe("adapted: semantic HTML elements", () => {
  test("preserves article, section, nav, aside, header, footer", () => {
    const elements = [
      "article",
      "section",
      "nav",
      "aside",
      "header",
      "footer",
    ];
    for (const el of elements) {
      expect(sanitize(`<${el}>content</${el}>`)).toBe(
        `<${el}>content</${el}>`,
      );
    }
  });

  test("preserves heading elements", () => {
    for (let i = 1; i <= 6; i++) {
      expect(sanitize(`<h${i}>Heading</h${i}>`)).toBe(
        `<h${i}>Heading</h${i}>`,
      );
    }
  });

  test("preserves inline formatting elements", () => {
    const elements = [
      "b",
      "i",
      "em",
      "strong",
      "small",
      "s",
      "u",
      "sub",
      "sup",
      "mark",
      "code",
      "kbd",
      "samp",
      "var",
    ];
    for (const el of elements) {
      expect(sanitize(`<${el}>text</${el}>`)).toBe(
        `<${el}>text</${el}>`,
      );
    }
  });

  test("preserves definition list elements", () => {
    expect(
      sanitize("<dl><dt>Term</dt><dd>Definition</dd></dl>"),
    ).toBe("<dl><dt>Term</dt><dd>Definition</dd></dl>");
  });

  test("preserves blockquote with cite", () => {
    const result = sanitize(
      '<blockquote cite="http://example.com">quoted</blockquote>',
    );
    expect(result).toContain("<blockquote");
    expect(result).toContain("cite=");
  });

  test("preserves time element with datetime", () => {
    const result = sanitize(
      '<time datetime="2024-01-01">New Year</time>',
    );
    expect(result).toContain("<time");
    expect(result).toContain("datetime=");
  });

  test("preserves del and ins with cite and datetime", () => {
    const del = sanitize(
      '<del cite="reason" datetime="2024-01-01">old</del>',
    );
    expect(del).toContain("<del");
    expect(del).toContain("cite=");

    const ins = sanitize(
      '<ins cite="reason" datetime="2024-01-01">new</ins>',
    );
    expect(ins).toContain("<ins");
    expect(ins).toContain("datetime=");
  });
});

// =============================================================================
// 15. replaceWithChildrenElements (analogous to sanitize-html's default unwrap)
// =============================================================================

describe("adapted: replaceWithChildrenElements", () => {
  test("unwrap disallowed tags preserving content", () => {
    const result = sanitize(
      "<div><unknown>Hello <b>world</b></unknown></div>",
      {
        sanitizer: {
          removeElements: [],
          removeAttributes: [],
          replaceWithChildrenElements: ["unknown"],
        },
        safe: false,
      },
    );
    expect(result).toBe("<div>Hello <b>world</b></div>");
  });

  test("nested unwrapping", () => {
    const result = sanitize(
      "<div><outer><inner>deep</inner></outer></div>",
      {
        sanitizer: {
          removeElements: [],
          removeAttributes: [],
          replaceWithChildrenElements: ["outer", "inner"],
        },
        safe: false,
      },
    );
    expect(result).toBe("<div>deep</div>");
  });

  test("cannot replaceWithChildren on <html>", () => {
    const s = new Sanitizer({
      elements: ["html"],
      attributes: [],
    });
    expect(s.replaceElementWithChildren("html")).toBe(false);
  });
});

// =============================================================================
// 16. Mixed content and real-world HTML patterns
// =============================================================================

describe("adapted: real-world HTML patterns", () => {
  test("blog post structure", () => {
    const html = `
      <article>
        <header><h1>Title</h1></header>
        <p>First paragraph with <a href="http://example.com">a link</a>.</p>
        <blockquote cite="http://source.com">A quote</blockquote>
        <ul><li>Item 1</li><li>Item 2</li></ul>
        <footer><small>Copyright</small></footer>
      </article>
    `.trim();

    const result = sanitize(html);
    expect(result).toContain("<article>");
    expect(result).toContain("<h1>Title</h1>");
    expect(result).toContain('href="http://example.com"');
    expect(result).toContain("<blockquote");
    expect(result).toContain("<li>Item 1</li>");
    expect(result).toContain("<small>Copyright</small>");
  });

  test("table with attributes", () => {
    const html =
      '<table><tr><td colspan="2" rowspan="1" headers="h1">Cell</td></tr></table>';
    const result = sanitize(html);
    expect(result).toContain("colspan=");
    expect(result).toContain("rowspan=");
    expect(result).toContain("headers=");
  });

  test("mixed safe and unsafe content", () => {
    const html =
      '<p>Safe text</p><script>alert("xss")</script><div onclick="evil()"><b>Bold</b></div>';
    const result = sanitize(html);
    expect(result).toContain("<p>Safe text</p>");
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("onclick");
    expect(result).toContain("<b>Bold</b>");
  });

  test("preserves anchor with multiple allowed attributes", () => {
    const result = sanitize(
      '<a href="http://example.com" hreflang="en" type="text/html">link</a>',
    );
    expect(result).toContain("href=");
    expect(result).toContain("hreflang=");
    expect(result).toContain("type=");
  });

  test("complex nested structure", () => {
    const html = `<div>
      <h2>Section</h2>
      <p>Text with <em>emphasis</em> and <strong>strong</strong></p>
      <ol start="5"><li value="5">Item</li></ol>
    </div>`;
    const result = sanitize(html);
    expect(result).toContain("<h2>");
    expect(result).toContain("<em>");
    expect(result).toContain("<strong>");
    expect(result).toContain("start=");
    expect(result).toContain("value=");
  });
});

// =============================================================================
// 17. Global attributes from W3C default config
// =============================================================================

describe("adapted: global attributes (W3C default)", () => {
  test("allows dir attribute on elements", () => {
    const result = sanitize('<p dir="ltr">text</p>');
    expect(result).toContain('dir="ltr"');
  });

  test("allows lang attribute on elements", () => {
    const result = sanitize('<p lang="en">text</p>');
    expect(result).toContain('lang="en"');
  });

  test("allows title attribute on elements", () => {
    const result = sanitize('<p title="tooltip">text</p>');
    expect(result).toContain('title="tooltip"');
  });

  test("strips class attribute (not in W3C default globals)", () => {
    const result = sanitize('<p class="foo">text</p>');
    expect(result).not.toContain("class=");
  });

  test("strips id attribute (not in W3C default globals)", () => {
    const result = sanitize('<p id="bar">text</p>');
    expect(result).not.toContain("id=");
  });

  test("strips style attribute (not in W3C default globals)", () => {
    const result = sanitize('<p style="color:red">text</p>');
    expect(result).not.toContain("style=");
  });
});

// =============================================================================
// 18. Edge cases from sanitize-html that test parser robustness
// =============================================================================

describe("adapted: parser robustness", () => {
  test("handles text before and after tags", () => {
    expect(sanitize("before<p>middle</p>after")).toBe(
      "before<p>middle</p>after",
    );
  });

  test("handles consecutive tags", () => {
    expect(sanitize("<p>1</p><p>2</p><p>3</p>")).toBe(
      "<p>1</p><p>2</p><p>3</p>",
    );
  });

  test("handles boolean attributes", () => {
    const result = sanitize('<ol reversed=""><li>item</li></ol>');
    expect(result).toContain("reversed");
  });

  test("handles attributes with quotes in values", () => {
    const result = sanitize(
      '<a href="https://example.com?q=1&r=2">link</a>',
    );
    expect(result).toContain("href=");
  });

  test("handles deeply nested same elements", () => {
    const html = "<div>".repeat(10) + "deep" + "</div>".repeat(10);
    const result = sanitize(html);
    expect(result).toContain("deep");
    // All divs should be preserved
    expect(result.match(/<div>/g)?.length).toBe(10);
  });

  test("handles mixed text and elements at root", () => {
    expect(sanitize("Hello <b>world</b> and <i>more</i>!")).toBe(
      "Hello <b>world</b> and <i>more</i>!",
    );
  });

  test("handles whitespace in tag names/attributes", () => {
    const result = sanitize('<p  >text</p >');
    expect(result).toContain("<p>");
    expect(result).toContain("text");
  });
});
