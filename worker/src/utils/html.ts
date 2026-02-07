import sanitize from "sanitize-html";

const normalizeText = (text: string): string => {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();

  return normalized;
};

const decodeBasicEntities = (text: string): string => {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)));
};

const looksGarbled = (text: string): boolean => {
  const replacement = (text.match(/\uFFFD/g) ?? []).length;
  if (replacement > 0) return true;

  // Common sign of un-decoded MIME encoded words
  if (/=\?utf-8\?/i.test(text)) return true;

  return false;
};

const hasOtpLikeCode = (text: string): boolean => /\b\d{6,8}\b/.test(text);
const hasHttpUrl = (text: string): boolean => /\bhttps?:\/\/\S+/i.test(text);

const isUsablePlainText = (text: string): boolean => {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (looksGarbled(normalized)) return false;

  // Short but useful: OTP / verification link emails
  if (hasOtpLikeCode(normalized) || hasHttpUrl(normalized)) return true;

  const alphaNum = (normalized.match(/[A-Za-z0-9]/g) ?? []).length;
  if (alphaNum < 10) return false;

  return normalized.length >= 40;
};

export const sanitizeHtml = (html: string): string => {
  return sanitize(html, {
    // NOTE: Prefer safe + readable HTML, not perfect visual fidelity.
    allowedTags: sanitize.defaults.allowedTags.concat([
      "img",
      "span",
      "table",
      "thead",
      "tbody",
      "tfoot",
      "tr",
      "th",
      "td",
      "hr",
    ]),
    allowedAttributes: {
      a: ["href", "name", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      table: ["cellpadding", "cellspacing", "border"],
      td: ["colspan", "rowspan", "align", "valign"],
      th: ["colspan", "rowspan", "align", "valign"],
      span: ["data-mailbox-img", "data-src"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attribs) => {
        const nextAttribs = { ...attribs };
        nextAttribs.target = "_blank";
        nextAttribs.rel = "noreferrer noopener";
        return {
          tagName: "a",
          attribs: nextAttribs,
        };
      },
      img: (_tagName, attribs) => {
        const src = typeof attribs.src === "string" ? attribs.src : "";
        const alt = typeof attribs.alt === "string" ? attribs.alt : "";

        // Block all image loads by default (privacy-safe). Keep a placeholder
        // with the original `src` for potential future "click-to-load".
        return {
          tagName: "span",
          attribs: {
            "data-mailbox-img": "1",
            "data-src": src,
          },
          text: alt ? `[Image: ${alt}]` : "[Image blocked]",
        };
      },
    },
    exclusiveFilter: (frame) => {
      // Drop tracking pixels (1x1 etc) entirely.
      if (frame.tag === "img") {
        const width = Number.parseInt(String(frame.attribs.width ?? ""), 10);
        const height = Number.parseInt(String(frame.attribs.height ?? ""), 10);
        if ((Number.isFinite(width) && width <= 1) || (Number.isFinite(height) && height <= 1)) {
          return true;
        }
      }

      // Drop hidden elements
      if (
        typeof frame.attribs.style === "string" &&
        /display\s*:\s*none/i.test(frame.attribs.style)
      ) {
        return true;
      }

      return false;
    },
  });
};

export const htmlToCleanText = async (html: string): Promise<string> => {
  try {
    // Lazy-load to avoid Worker startup failures if a dependency is incompatible
    // with the runtime. If loading fails, we fall back to a simpler extractor.
    const { htmlToText } = await import("html-to-text");

    const text = htmlToText(html, {
      wordwrap: false,
      // Keep link hrefs in parentheses; hide when same as link text.
      selectors: [
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } },
        { selector: "img", format: "skip" },
      ],
    });

    return normalizeText(decodeBasicEntities(text));
  } catch {
    return extractText(html);
  }
};

const removeCommonFooters = (text: string): string => {
  const lines = normalizeText(text).split("\n");
  const stopPatterns = [
    /\bunsubscribe\b/i,
    /\bmanage\s+preferences\b/i,
    /\bprivacy\s+policy\b/i,
    /\bterms\s+of\s+service\b/i,
    /\ball\s+rights\s+reserved\b/i,
  ];

  let cutIndex = lines.length;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]?.trim() ?? "";
    if (!line) continue;
    if (stopPatterns.some((p) => p.test(line))) {
      cutIndex = i;
      break;
    }
  }

  const head = lines.slice(0, cutIndex).join("\n");
  return normalizeText(head);
};

const boostOtpAndLinks = (text: string): string => {
  const normalized = normalizeText(text);
  if (!normalized) return normalized;

  const otpMatches = Array.from(new Set((normalized.match(/\b\d{6,8}\b/g) ?? []).slice(0, 3)));
  const urls = Array.from(
    new Set(
      (normalized.match(/\bhttps?:\/\/[^\s)]+/gi) ?? [])
        .map((u) => u.replace(/[.,;:!?]+$/, ""))
        .slice(0, 3),
    ),
  );

  const headerLines: string[] = [];
  if (otpMatches.length > 0) headerLines.push(`OTP: ${otpMatches.join(", ")}`);
  if (urls.length > 0) headerLines.push(`Links: ${urls.join(" ")}`);

  if (headerLines.length === 0) return normalized;
  return normalizeText(`${headerLines.join("\n")}\n\n${normalized}`);
};

export const buildBodyTextClean = async (input: {
  plainText?: string | null;
  sanitizedHtml?: string | null;
}): Promise<string> => {
  const plainText = input.plainText ?? "";
  const sanitizedHtml = input.sanitizedHtml ?? "";

  if (plainText && isUsablePlainText(plainText)) {
    return boostOtpAndLinks(removeCommonFooters(normalizeText(plainText)));
  }

  if (sanitizedHtml) {
    const converted = await htmlToCleanText(sanitizedHtml);
    if (converted) return boostOtpAndLinks(removeCommonFooters(converted));

    return boostOtpAndLinks(removeCommonFooters(extractText(sanitizedHtml)));
  }

  return boostOtpAndLinks(removeCommonFooters(normalizeText(plainText)));
};

export const extractText = (html: string): string => {
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h[1-6]|section|article|blockquote|pre)\s*>/gi, "\n\n")
    .replace(/<\s*\/\s*(li|tr)\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "\n- ");

  const stripped = sanitize(withBreaks, {
    allowedTags: [],
    allowedAttributes: {},
  });

  return normalizeText(decodeBasicEntities(stripped));
};
