/**
 * Small CSS-value / URL helpers shared by marks and paste sanitizers.
 *
 * They intentionally accept only self-contained tokens. Values that need
 * another CSS declaration, nested functions, custom properties, quotes or URL
 * parsing are rejected before they can be rendered back into HTML.
 */

const MAX_COLOR_LENGTH = 80;
const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
const CSS_IDENTIFIER = /^[a-zA-Z]+$/;
const NUMBER_OR_PERCENT = /^[+-]?(?:\d+|\d*\.\d+)%?$/;
const HUE = /^[+-]?(?:\d+|\d*\.\d+)(?:deg|rad|turn)?$/i;
const PERCENT = /^[+-]?(?:\d+|\d*\.\d+)%$/;
const UNSAFE_COLOR_CHARS = /[;:"'<>\\]/;
const UNSAFE_URL_CHARS = /[\u0000-\u001f\u007f\s<>"']/u;
const FONT_FAMILY_TOKEN = /^[a-zA-Z0-9 ,"'-]+$/;
const CSS_LENGTH_TOKEN = /^(\d+(?:\.\d+)?)(px|pt|em|rem|%)?$/;
const LINE_HEIGHT_TOKEN = /^(\d+(?:\.\d+)?)(px|em|rem|%)?$/;
const TEXT_STROKE_WIDTH_TOKEN = /^(\d+(?:\.\d+)?)px$/i;
const SAFE_TARGETS = new Set(["_blank", "_self", "_parent", "_top"]);

export interface URLSanitizerOptions {
  protocols?: readonly string[];
  allowRelative?: boolean;
  allowFragments?: boolean;
  allowBareEmail?: boolean;
  allowDataUrls?: boolean;
  dataUrlPattern?: RegExp;
  maxDataUrlLength?: number;
}

export function sanitizeCSSColor(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value || value.length > MAX_COLOR_LENGTH) return null;
  if (UNSAFE_COLOR_CHARS.test(value)) return null;
  if (HEX_COLOR.test(value)) return value;
  if (CSS_IDENTIFIER.test(value)) return value;
  if (isRGBColor(value)) return value;
  if (isHSLColor(value)) return value;
  return null;
}

export function sanitizeCSSFontFamily(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value || value.length > 200) return null;
  return FONT_FAMILY_TOKEN.test(value) ? value : null;
}

export function sanitizeCSSFontSize(raw: unknown): string | null {
  const parsed = sanitizeCSSLength(raw, 400, "px", true);
  return parsed;
}

export function sanitizeCSSLineHeight(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  const match = LINE_HEIGHT_TOKEN.exec(value);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0 || number > 10) return null;
  return match[2] ? `${match[1]}${match[2]}` : match[1];
}

export function sanitizeCSSTextStrokeWidth(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  const match = TEXT_STROKE_WIDTH_TOKEN.exec(value);
  if (!match) return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number < 0 || number > 8) return null;
  return `${match[1]}px`;
}

export function sanitizeURL(
  raw: unknown,
  options: URLSanitizerOptions = {},
): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  if (!value || UNSAFE_URL_CHARS.test(value)) return null;

  if (value.startsWith("#")) {
    return options.allowFragments === false ? null : value;
  }

  if (options.allowFragments === false && value.includes("#")) return null;

  if (options.allowRelative !== false && isSafeRelativeURL(value)) {
    return value;
  }

  if (options.allowBareEmail && isBareEmail(value)) {
    return value;
  }

  if (/^data:/i.test(value)) {
    const maxLength = options.maxDataUrlLength ?? 2_000_000;
    if (!options.allowDataUrls || value.length > maxLength) return null;
    return options.dataUrlPattern?.test(value) ? value : null;
  }

  const protocols = normaliseProtocols(options.protocols ?? ["http", "https"]);
  try {
    const url = new URL(value);
    const protocol = url.protocol.replace(/:$/, "").toLowerCase();
    return protocols.has(protocol) ? value : null;
  } catch {
    return null;
  }
}

export function sanitizeLinkTarget(raw: unknown): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  return SAFE_TARGETS.has(value) ? value : null;
}

export function hardenLinkAttrs(
  attrs: Record<string, string>,
): Record<string, string> {
  if (attrs.target === "_blank") {
    return { ...attrs, rel: "noopener noreferrer" };
  }
  const { rel: _rel, ...withoutRel } = attrs;
  return withoutRel;
}

function sanitizeCSSLength(
  raw: unknown,
  max: number,
  defaultUnit: string,
  allowPercent: boolean,
): string | null {
  if (raw == null) return null;
  const value = String(raw).trim();
  const match = CSS_LENGTH_TOKEN.exec(value);
  if (!match) return null;
  if (!allowPercent && match[2] === "%") return null;
  const number = Number(match[1]);
  if (!Number.isFinite(number) || number <= 0 || number > max) return null;
  const unit = match[2] ?? defaultUnit;
  return `${match[1]}${unit}`;
}

function isRGBColor(value: string): boolean {
  const match = /^rgba?\((.*)\)$/i.exec(value);
  if (!match) return false;
  const parsed = parseFunctionalColor(match[1]);
  return Boolean(
    parsed &&
      parsed.channels.length === 3 &&
      parsed.channels.every((channel) => NUMBER_OR_PERCENT.test(channel)) &&
      (!parsed.alpha || NUMBER_OR_PERCENT.test(parsed.alpha)),
  );
}

function isHSLColor(value: string): boolean {
  const match = /^hsla?\((.*)\)$/i.exec(value);
  if (!match) return false;
  const parsed = parseFunctionalColor(match[1]);
  return Boolean(
    parsed &&
      parsed.channels.length === 3 &&
      HUE.test(parsed.channels[0]) &&
      PERCENT.test(parsed.channels[1]) &&
      PERCENT.test(parsed.channels[2]) &&
      (!parsed.alpha || NUMBER_OR_PERCENT.test(parsed.alpha)),
  );
}

function parseFunctionalColor(
  body: string,
): { channels: string[]; alpha: string | null } | null {
  if (/[^\d.%+\-/,\sA-Za-z]/.test(body)) return null;

  if (body.includes(",")) {
    const parts = body.split(",").map((part) => part.trim());
    if (parts.length !== 3 && parts.length !== 4) return null;
    if (parts.some((part) => !part || part.includes("/"))) return null;
    return {
      channels: parts.slice(0, 3),
      alpha: parts[3] ?? null,
    };
  }

  const slashParts = body.split("/").map((part) => part.trim());
  if (slashParts.length > 2) return null;
  const channels = slashParts[0].split(/\s+/).filter(Boolean);
  const alpha = slashParts[1] ?? null;
  if (channels.length !== 3) return null;
  if (alpha !== null && !alpha) return null;
  return { channels, alpha };
}

function isSafeRelativeURL(value: string): boolean {
  if (value.startsWith("//")) return false;
  if (value.startsWith("/") || value.startsWith("?")) return true;
  if (value.includes(":")) return false;
  return /^[.\w~-][.\w~!$&'()*+,;=:@/-]*(?:\?[^#]*)?(?:#.*)?$/u.test(value);
}

function isBareEmail(value: string): boolean {
  return /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(value);
}

function normaliseProtocols(protocols: readonly string[]): Set<string> {
  return new Set(
    protocols
      .map((protocol) => protocol.trim().replace(/:$/, "").toLowerCase())
      .filter(Boolean),
  );
}
