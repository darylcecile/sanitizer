/**
 * Constants: namespace URIs, event handler attributes, void/raw-text elements.
 */

// Namespace URIs
export const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
export const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
export const XLINK_NAMESPACE = "http://www.w3.org/1999/xlink";

// Void elements (self-closing, no children)
export const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

// Raw text elements (content is not parsed as HTML)
export const RAW_TEXT_ELEMENTS = new Set(["script", "style", "xmp"]);

// Escapable raw text elements
export const ESCAPABLE_RAW_TEXT_ELEMENTS = new Set(["textarea", "title"]);

// Event handler content attributes (per HTML spec)
export const EVENT_HANDLER_ATTRIBUTES = new Set([
  "onabort",
  "onafterprint",
  "onauxclick",
  "onbeforeinput",
  "onbeforematch",
  "onbeforeprint",
  "onbeforetoggle",
  "onbeforeunload",
  "onblur",
  "oncancel",
  "oncanplay",
  "oncanplaythrough",
  "onchange",
  "onclick",
  "onclose",
  "oncontextlost",
  "oncontextmenu",
  "oncontextrestored",
  "oncopy",
  "oncuechange",
  "oncut",
  "ondblclick",
  "ondrag",
  "ondragend",
  "ondragenter",
  "ondragleave",
  "ondragover",
  "ondragstart",
  "ondrop",
  "ondurationchange",
  "onemptied",
  "onended",
  "onerror",
  "onfocus",
  "onformdata",
  "onhashchange",
  "oninput",
  "oninvalid",
  "onkeydown",
  "onkeypress",
  "onkeyup",
  "onlanguagechange",
  "onload",
  "onloadeddata",
  "onloadedmetadata",
  "onloadstart",
  "onmessage",
  "onmessageerror",
  "onmousedown",
  "onmouseenter",
  "onmouseleave",
  "onmousemove",
  "onmouseout",
  "onmouseover",
  "onmouseup",
  "onoffline",
  "ononline",
  "onpagehide",
  "onpagereveal",
  "onpageshow",
  "onpageswap",
  "onpaste",
  "onpause",
  "onplay",
  "onplaying",
  "onpopstate",
  "onprogress",
  "onratechange",
  "onreset",
  "onresize",
  "onrejectionhandled",
  "onscroll",
  "onscrollend",
  "onsecuritypolicyviolation",
  "onseeked",
  "onseeking",
  "onselect",
  "onslotchange",
  "onstalled",
  "onstorage",
  "onsubmit",
  "onsuspend",
  "ontimeupdate",
  "ontoggle",
  "onunhandledrejection",
  "onunload",
  "onvolumechange",
  "onwaiting",
  "onwheel",
]);

/**
 * Built-in navigating URL attributes list.
 * Pairs of [elementName, attributeName] where javascript: URLs are unsafe.
 */
export const NAVIGATING_URL_ATTRIBUTES: Array<
  [{ name: string; namespace: string }, { name: string; namespace: null }]
> = [
  [
    { name: "a", namespace: HTML_NAMESPACE },
    { name: "href", namespace: null },
  ],
  [
    { name: "area", namespace: HTML_NAMESPACE },
    { name: "href", namespace: null },
  ],
  [
    { name: "base", namespace: HTML_NAMESPACE },
    { name: "href", namespace: null },
  ],
  [
    { name: "button", namespace: HTML_NAMESPACE },
    { name: "formaction", namespace: null },
  ],
  [
    { name: "form", namespace: HTML_NAMESPACE },
    { name: "action", namespace: null },
  ],
  [
    { name: "input", namespace: HTML_NAMESPACE },
    { name: "formaction", namespace: null },
  ],
  [
    { name: "a", namespace: SVG_NAMESPACE },
    { name: "href", namespace: null },
  ],
  // SVG <a> with xlink:href
  [
    { name: "a", namespace: SVG_NAMESPACE },
    { name: "href", namespace: XLINK_NAMESPACE as unknown as null },
  ],
];

/**
 * Built-in animating URL attributes list.
 * SVG animation elements that can modify navigation attributes.
 */
export const ANIMATING_URL_ATTRIBUTES: Array<
  [{ name: string; namespace: string }, { name: string; namespace: null }]
> = [
  [
    { name: "animate", namespace: SVG_NAMESPACE },
    { name: "attributeName", namespace: null },
  ],
  [
    { name: "animateTransform", namespace: SVG_NAMESPACE },
    { name: "attributeName", namespace: null },
  ],
  [
    { name: "set", namespace: SVG_NAMESPACE },
    { name: "attributeName", namespace: null },
  ],
];
