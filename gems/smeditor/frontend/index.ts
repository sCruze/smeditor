import {
  contrastTextColor,
  createEditor,
  getBlockAttr,
  selectionInsideWrapper,
  type EditorInstance,
  type Extension,
} from "@smeditor/core";
import { StarterKit, ImageExtension } from "@smeditor/starter-kit";
import { FullKit } from "@smeditor/full-kit";

type SMInput = HTMLInputElement & { smeditorInstance?: EditorInstance };
type SMMount = HTMLElement & { smeditorInstance?: EditorInstance };

type DropdownItemSpec = {
  label: string;
  icon?: string;
  shortcut?: string;
  active?: () => boolean;
  disabled?: () => boolean;
  action?: () => void;
  separatorBefore?: boolean;
  content?: HTMLElement;
};

const instances = new Map<HTMLElement, EditorInstance>();
const disposers = new Map<HTMLElement, Array<() => void>>();

const ICONS: Record<string, string> = {
  undo: '<path d="M3.5 8h7a3 3 0 0 1 0 6H6"/><path d="m6 4-3 4 3 4"/>',
  redo: '<path d="M12.5 8h-7a3 3 0 0 0 0 6H10"/><path d="m10 4 3 4-3 4"/>',
  bold: '<path d="M4 3h4.5a2.5 2.5 0 0 1 0 5H4z"/><path d="M4 8h5a2.5 2.5 0 0 1 0 5H4z"/>',
  italic: '<path d="M10 3 6 13"/><path d="M6 3h5"/><path d="M5 13h5"/>',
  strike: '<path d="M3 8h10"/><path d="M5.5 4.5C6 4 6.7 3.5 8 3.5c2 0 3 1 3 2.5"/><path d="M5 11c0 1.4 1.3 2.5 3 2.5 1.8 0 3-1 3-2.2"/>',
  underline: '<path d="M4 3v5a4 4 0 0 0 8 0V3"/><path d="M3.5 13.5h9"/>',
  code: '<path d="m6 5-3 3 3 3"/><path d="m10 5 3 3-3 3"/>',
  eraser: '<path d="m9 3 5 5-6 6H4l-1-1z"/><path d="m6 6 5 5"/><path d="M9 14h5"/>',
  link: '<path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 1 0-4-4L8 4"/><path d="M9 7a3 3 0 0 0-4 0l-2 2a3 3 0 1 0 4 4l1-1"/>',
  highlight: '<path d="M3.5 11.5l2.5-.8 6-6-1.7-1.7-6 6z"/><path d="M9 4.3l1.7 1.7"/>',
  textColor: '<path d="M4 12 8 2.5 12 12"/><path d="M5.6 8.5h4.8"/>',
  underlineColor: '<path d="M4.5 2.5v4.5a3.5 3.5 0 0 0 7 0V2.5"/>',
  background: '<path d="M3 7.5 7.5 3l5 5-4.5 4.5z"/><path d="M13 11.2c0 .8-.5 1.3-1 1.3s-1-.5-1-1.3.5-1.5 1-2.2c.5.7 1 1.4 1 2.2z" fill="currentColor"/>',
  blockquote: '<path d="M3 5v3c0 1.5-.7 2.5-2 3"/><path d="M9 5v3c0 1.5-.7 2.5-2 3"/>',
  codeBlock: '<rect x="1.5" y="3" width="13" height="10" rx="1.5"/><path d="m5 6.5-2 1.5 2 1.5"/><path d="m11 6.5 2 1.5-2 1.5"/>',
  hr: '<path d="M2 8h12"/><path d="M2 4h8"/><path d="M2 12h6"/>',
  bullet: '<circle cx="3.5" cy="4.5" r=".7" fill="currentColor"/><circle cx="3.5" cy="8" r=".7" fill="currentColor"/><circle cx="3.5" cy="11.5" r=".7" fill="currentColor"/><path d="M6 4.5h7M6 8h7M6 11.5h7"/>',
  ordered: '<text x="2" y="6" font-size="4" font-family="monospace" fill="currentColor" stroke="none">1.</text><text x="2" y="13" font-size="4" font-family="monospace" fill="currentColor" stroke="none">2.</text><path d="M6 4.5h7M6 11.5h7"/>',
  task: '<rect x="2" y="3" width="3" height="3" rx=".5"/><path d="m2.5 4.5 1 1 1.5-1.5"/><rect x="2" y="10" width="3" height="3" rx=".5"/><path d="M7 4.5h6M7 11.5h6"/>',
  alignLeft: '<path d="M2.5 4h11M2.5 7h7M2.5 10h11M2.5 13h7"/>',
  alignCenter: '<path d="M2.5 4h11M4.5 7h7M2.5 10h11M4.5 13h7"/>',
  alignRight: '<path d="M2.5 4h11M6.5 7h7M2.5 10h11M6.5 13h7"/>',
  alignJustify: '<path d="M2.5 4h11M2.5 7h11M2.5 10h11M2.5 13h11"/>',
  indent: '<path d="M2 4h12M7 8h7M2 12h12"/><path d="m2 7 2 1.5L2 10" fill="currentColor"/>',
  outdent: '<path d="M2 4h12M7 8h7M2 12h12"/><path d="m6 7-2 1.5L6 10" fill="currentColor"/>',
  image: '<rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="5.5" cy="6.5" r="1.2"/><path d="m2.5 11 3.5-3.5 2.5 2.5L11 7.5l2.5 2.5"/>',
  table: '<rect x="2" y="3" width="12" height="10" rx="1"/><path d="M2 6.5h12M2 10h12M6 3v10M10 3v10"/>',
  more: '<circle cx="3.5" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="12.5" cy="8" r="1.2" fill="currentColor"/>',
  heading: '<text x="2" y="12" font-family="sans-serif" font-size="9" font-weight="700" fill="currentColor" stroke="none">H</text><text x="9.5" y="13" font-family="sans-serif" font-size="6" font-weight="700" fill="currentColor" stroke="none">2</text>',
  paragraph: '<text x="3" y="12" font-family="serif" font-size="11" font-weight="700" fill="currentColor" stroke="none">¶</text>',
  subscript: '<path d="M3 4l4 5"/><path d="M7 4l-4 5"/><text x="9" y="14" font-size="6" font-weight="700" fill="currentColor" stroke="none">x</text>',
  superscript: '<path d="M3 6l4 5"/><path d="M7 6l-4 5"/><text x="9" y="7" font-size="6" font-weight="700" fill="currentColor" stroke="none">x</text>',
};

function svgIcon(name: string, strokeWidth = 1.5): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "16");
  svg.setAttribute("height", "16");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", String(strokeWidth));
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = ICONS[name] || "";
  return svg;
}

function csrfToken(): string | null {
  return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null;
}

function uploadHandler(uploadUrl: string | undefined) {
  if (!uploadUrl) return undefined;
  return async (file: File) => {
    const body = new FormData();
    body.append("file", file);
    const headers: Record<string, string> = {};
    const token = csrfToken();
    if (token) headers["X-CSRF-Token"] = token;
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers,
      body,
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error(`SMEditor upload failed with ${response.status}`);
    return response.json();
  };
}

function kitExtensions(kit: string, uploadUrl?: string): Extension[] {
  const base = kit === "full" ? FullKit.extensions : StarterKit.extensions;
  const upload = uploadHandler(uploadUrl);
  if (!upload) return [...base];
  return base.map((extension) =>
    extension.name === "image" && ImageExtension.configure ? ImageExtension.configure({ upload }) : extension,
  );
}

function run(editor: EditorInstance, command: string, ...args: unknown[]): boolean {
  const fn = editor.commands[command];
  if (typeof fn !== "function") return false;
  const result = fn(...args);
  editor.focus();
  return Boolean(result);
}

function hasCommand(editor: EditorInstance, command: string): boolean {
  return typeof editor.commands[command] === "function";
}

function divider(): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "smeditor-toolbar__divider";
  el.setAttribute("role", "separator");
  el.setAttribute("aria-hidden", "true");
  return el;
}

function commandButton(
  editor: EditorInstance,
  iconName: string,
  title: string,
  command: () => boolean | void,
  active?: () => boolean,
  label?: string,
): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "smeditor-button";
  el.title = title;
  el.setAttribute("aria-label", title);
  if (label) el.textContent = label;
  else el.appendChild(svgIcon(iconName, iconName === "bold" ? 2 : 1.5));
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", () => command());
  const refresh = () => {
    if (active) {
      const value = active();
      el.dataset.active = value ? "true" : "false";
      el.classList.toggle("is-active", value);
      el.setAttribute("aria-pressed", String(value));
    }
  };
  (el as any).__smeditorRefresh = refresh;
  refresh();
  return el;
}

type DropdownOptions = {
  /** Short text shown next to the trigger content (e.g. "H2"). */
  summary?: () => string;
  /** Replaces the trigger text on every refresh (current font, size…). */
  labelText?: () => string;
  /** Replaces the trigger icon on every refresh (current alignment, list…). */
  icon?: () => string;
  /** Lets the trigger decorate itself on refresh (colour indicator…). */
  decorate?: (trigger: HTMLButtonElement) => void;
  active?: () => boolean;
  align?: "left" | "right";
};

function dropdown(
  ariaLabel: string,
  triggerContent: Element | string,
  items: (close: () => void) => DropdownItemSpec[],
  options: DropdownOptions = {},
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "smeditor-dropdown";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "smeditor-button smeditor-dropdown__trigger";
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  trigger.setAttribute("aria-label", ariaLabel);
  trigger.title = ariaLabel;

  const label = document.createElement("span");
  label.className = "smeditor-dropdown__label";
  if (typeof triggerContent === "string") {
    label.classList.add("smeditor-dropdown__label--text");
    label.textContent = triggerContent;
  } else label.appendChild(triggerContent);
  let currentIcon = "";
  trigger.appendChild(label);

  let summary: HTMLSpanElement | null = null;
  if (options.summary) {
    summary = document.createElement("span");
    summary.className = "smeditor-dropdown__summary";
    trigger.appendChild(summary);
  }
  const chevron = document.createElement("span");
  chevron.className = "smeditor-dropdown__chevron";
  chevron.setAttribute("aria-hidden", "true");
  chevron.textContent = "▾";
  trigger.appendChild(chevron);
  wrapper.appendChild(trigger);

  let menu: HTMLDivElement | null = null;
  const close = () => {
    wrapper.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    menu?.remove();
    menu = null;
  };
  const open = () => {
    if (menu) return close();
    wrapper.classList.add("is-open");
    trigger.setAttribute("aria-expanded", "true");
    menu = document.createElement("div");
    menu.className = "smeditor-dropdown__menu" + (options.align === "right" ? " is-right" : "");
    menu.setAttribute("role", "menu");
    menu.setAttribute("aria-label", ariaLabel);
    for (const spec of items(close)) {
      if (spec.separatorBefore) {
        const sep = document.createElement("div");
        sep.className = "smeditor-dropdown__separator";
        sep.setAttribute("role", "separator");
        menu.appendChild(sep);
      }
      if (spec.content) {
        menu.appendChild(spec.content);
        continue;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.className = "smeditor-dropdown__item";
      item.setAttribute("role", spec.active ? "menuitemcheckbox" : "menuitem");
      const isActive = spec.active?.() ?? false;
      if (spec.active) item.setAttribute("aria-checked", String(isActive));
      item.classList.toggle("is-active", isActive);
      item.dataset.active = isActive ? "true" : "false";
      const isDisabled = spec.disabled?.() ?? false;
      item.disabled = isDisabled;
      if (isDisabled) item.setAttribute("aria-disabled", "true");
      if (spec.icon) {
        const icon = document.createElement("span");
        icon.className = "smeditor-dropdown__item-icon";
        icon.appendChild(svgIcon(spec.icon));
        item.appendChild(icon);
      }
      const text = document.createElement("span");
      text.className = "smeditor-dropdown__item-label";
      text.textContent = spec.label;
      item.appendChild(text);
      if (spec.shortcut) {
        const shortcut = document.createElement("span");
        shortcut.className = "smeditor-dropdown__item-shortcut";
        shortcut.textContent = spec.shortcut;
        item.appendChild(shortcut);
      }
      item.addEventListener("mousedown", (event) => event.preventDefault());
      item.addEventListener("click", () => {
        if (item.disabled) return;
        spec.action?.();
        close();
      });
      menu.appendChild(item);
    }
    wrapper.appendChild(menu);
    // Keep the popover on screen: flip it to the trigger's right edge
    // when it would overflow the viewport (last toolbar items, bubble).
    if (options.align !== "right" && menu.getBoundingClientRect().right > window.innerWidth - 8) {
      menu.classList.add("is-right");
    }
  };

  trigger.addEventListener("mousedown", (event) => event.preventDefault());
  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    open();
  });
  const outside = (event: Event) => {
    if (!menu) return;
    const path = event.composedPath();
    if (!path.includes(wrapper)) close();
  };
  document.addEventListener("pointerdown", outside, true);
  const refresh = () => {
    if (summary && options.summary) summary.textContent = options.summary();
    if (options.labelText) {
      const text = options.labelText();
      label.textContent = text;
      trigger.title = `${ariaLabel}: ${text}`;
    }
    if (options.icon) {
      const name = options.icon();
      if (name !== currentIcon) {
        currentIcon = name;
        label.replaceChildren(svgIcon(name));
      }
    }
    options.decorate?.(trigger);
    if (options.active) {
      const value = options.active();
      trigger.dataset.active = value ? "true" : "false";
      trigger.classList.toggle("is-active", value);
    }
  };
  (wrapper as any).__smeditorRefresh = refresh;
  (wrapper as any).__smeditorClose = close;
  (wrapper as any).__smeditorDispose = () => document.removeEventListener("pointerdown", outside, true);
  refresh();
  return wrapper;
}

const PALETTE = [
  "#1a1a1f", "#6b7280", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#ffffff", "#d1d5db", "#fecaca", "#fed7aa", "#fef08a",
  "#bbf7d0", "#a5f3fc", "#bfdbfe", "#ddd6fe", "#fbcfe8",
];

/** Text colour options on a fill; null = automatic contrast. */
const FILL_TEXT: Array<[string, string | null]> = [["Auto", null], ["White", "#ffffff"], ["Dark", "#1a1a1f"]];

type ColorSpec = {
  label: string;
  icon: string;
  mark: string;
  set: string;
  unset: string;
  /**
   * Fill / highlight: the palette sets the area colour and these chips
   * (under this caption) set the text colour on it.
   */
  textOn?: string;
};

function sameColor(a: unknown, b: unknown): boolean {
  return typeof a === "string" && typeof b === "string" && a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * The text colour the user chose for a fill: null when it is the
 * automatic contrast colour for the current fill (so re-filling with a
 * new colour keeps the text readable), otherwise the explicit colour.
 */
function fillTextChoice(attrs: Record<string, unknown> | null): string | null {
  const fill = typeof attrs?.color === "string" ? attrs.color : null;
  const text = typeof attrs?.textColor === "string" ? attrs.textColor : null;
  return fill && text && !sameColor(text, contrastTextColor(fill)) ? text : null;
}

function panelButton(text: string, className: string, action: () => void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.textContent = text;
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", action);
  return el;
}

/**
 * Colour picker dropdown. The trigger carries a bar filled with the colour
 * applied to the current selection, the palette marks that colour, and a
 * labelled "Remove" button clears it — so the state of the selection is
 * always visible and every applied colour can be undone from here.
 */
function colorDropdown(editor: EditorInstance, spec: ColorSpec): HTMLElement {
  const current = () => editor.getMarkAttributes(spec.mark);
  const icon = document.createElement("span");
  icon.className = "smeditor-color-trigger";
  icon.appendChild(svgIcon(spec.icon));
  const bar = document.createElement("span");
  bar.className = "smeditor-color-trigger__bar";
  icon.appendChild(bar);

  const wrapper = dropdown(spec.label, icon, (close) => {
    const attrs = current();
    const panel = document.createElement("div");
    panel.className = "smeditor-color-panel";
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", spec.label);

    const title = document.createElement("div");
    title.className = "smeditor-color-panel__title";
    title.textContent = spec.label;
    panel.appendChild(title);

    const grid = document.createElement("div");
    grid.className = "smeditor-color-grid";
    for (const color of PALETTE) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "smeditor-color-grid__swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.setAttribute("aria-label", `${spec.label}: ${color}`);
      const selected = sameColor(attrs?.color, color);
      swatch.classList.toggle("is-active", selected);
      swatch.setAttribute("aria-pressed", String(selected));
      swatch.addEventListener("mousedown", (event) => event.preventDefault());
      swatch.addEventListener("click", () => {
        run(editor, spec.set, spec.textOn ? { color, textColor: fillTextChoice(attrs) } : { color });
        close();
      });
      grid.appendChild(swatch);
    }
    panel.appendChild(grid);

    if (spec.textOn) {
      const label = document.createElement("div");
      label.className = "smeditor-color-panel__title";
      label.textContent = spec.textOn;
      const chips = document.createElement("div");
      chips.className = "smeditor-color-panel__widths";
      const choice = fillTextChoice(attrs);
      for (const [text, value] of FILL_TEXT) {
        const chip = panelButton(text, "smeditor-color-panel__chip", () => {
          run(editor, spec.set, { color: attrs?.color ?? PALETTE[7], textColor: value });
          close();
        });
        if (value) chip.style.setProperty("--sme-chip-swatch", value);
        chip.setAttribute("aria-label", `${spec.textOn}: ${text}`);
        const selected = Boolean(attrs) && choice === value;
        chip.classList.toggle("is-active", selected);
        chip.setAttribute("aria-pressed", String(selected));
        chips.appendChild(chip);
      }
      panel.append(label, chips);
    }

    const clear = panelButton(`Remove ${spec.label.toLowerCase()}`, "smeditor-color-panel__clear", () => {
      run(editor, spec.unset);
      close();
    });
    clear.disabled = !attrs?.color;
    panel.appendChild(clear);
    return [{ label: "", content: panel }];
  }, {
    active: () => Boolean(current()?.color),
    decorate: (trigger) => {
      const color = current()?.color;
      const value = typeof color === "string" ? color : "";
      bar.style.backgroundColor = value;
      bar.dataset.empty = value ? "false" : "true";
      trigger.title = value ? `${spec.label}: ${value}` : spec.label;
    },
  });
  wrapper.classList.add("smeditor-dropdown--color");
  return wrapper;
}

function blockTypeSummary(editor: EditorInstance): string {
  if (selectionInsideWrapper(editor.getJSON(), editor.getSelection(), "blockquote")) return "❝";
  if (editor.isActive("code_block")) return "</>";
  for (const level of [1, 2, 3, 4, 5, 6]) {
    if (editor.isActive("heading", { level })) return `H${level}`;
  }
  return "P";
}

function tablePicker(editor: EditorInstance): HTMLElement {
  return dropdown("Insert table", svgIcon("table"), () => {
    const grid = document.createElement("div");
    grid.className = "smeditor-table-picker";
    grid.setAttribute("role", "group");
    grid.setAttribute("aria-label", "Insert table size");
    const cells: HTMLButtonElement[] = [];
    const refreshHover = (rows: number, cols: number) => {
      cells.forEach((cell, idx) => {
        const r = Math.floor(idx / 6) + 1;
        const c = (idx % 6) + 1;
        cell.classList.toggle("is-on", r <= rows && c <= cols);
      });
      label.textContent = rows && cols ? `${rows} × ${cols}` : "Select size";
    };
    for (let r = 1; r <= 6; r++) {
      for (let c = 1; c <= 6; c++) {
        const cell = document.createElement("button");
        cell.type = "button";
        cell.className = "smeditor-table-picker__cell";
        cell.setAttribute("aria-label", `Insert ${r} by ${c} table`);
        cell.addEventListener("mouseenter", () => refreshHover(r, c));
        cell.addEventListener("mousedown", (e) => e.preventDefault());
        cell.addEventListener("click", () => run(editor, "insertTable", { rows: r, cols: c }));
        cells.push(cell);
        grid.appendChild(cell);
      }
    }
    const label = document.createElement("div");
    label.className = "smeditor-table-picker__label";
    label.textContent = "Select size";
    const box = document.createElement("div");
    box.append(grid, label);
    box.addEventListener("mouseleave", () => refreshHover(0, 0));
    return [{ label: "", content: box }];
  });
}

type ValueSpec = {
  ariaLabel: string;
  placeholder: string;
  values: Array<[string, string | null]>;
  current: () => string | null;
  apply: (value: string | null) => void;
  /** Show the raw value (20px, 1.5) on the trigger instead of the item name. */
  showValue?: boolean;
};

function normalizeValue(value: unknown): string {
  return String(value ?? "").replace(/["'\s]/g, "").toLowerCase();
}

/**
 * Value picker (font family, size, line height). The trigger shows the
 * value applied to the selection instead of a generic caption, and the
 * matching menu item is marked as checked.
 */
function valueDropdown(spec: ValueSpec): HTMLElement {
  const selected = () => {
    const value = spec.current();
    const match = value === null ? null : spec.values.find(([, v]) => v !== null && normalizeValue(v) === normalizeValue(value));
    const name = match ? match[0].split(" · ")[0] : value;
    return { value, label: spec.showValue ? value : name };
  };
  return dropdown(spec.ariaLabel, spec.placeholder, () => {
    const { value } = selected();
    return spec.values.map(([text, v]) => ({
      label: text,
      active: () => (v === null ? value === null : value !== null && normalizeValue(v) === normalizeValue(value)),
      action: () => spec.apply(v),
    }));
  }, {
    labelText: () => selected().label ?? spec.placeholder,
    active: () => spec.current() !== null,
  });
}

function markValue(editor: EditorInstance, mark: string, attr: string): string | null {
  const value = editor.getMarkAttributes(mark)?.[attr];
  return typeof value === "string" && value ? value : null;
}

function blockValue(editor: EditorInstance, attr: string): string | null {
  const value = getBlockAttr(editor.getJSON(), editor.getSelection(), attr);
  return typeof value === "string" && value ? value : null;
}

function currentAlign(editor: EditorInstance): string {
  return blockValue(editor, "textAlign") ?? "left";
}

function currentListIcon(editor: EditorInstance): string {
  const inside = (name: string) => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), name);
  if (inside("task_list")) return "task";
  if (inside("ordered_list")) return "ordered";
  return "bullet";
}

function inlineMarkButtons(editor: EditorInstance): HTMLElement[] {
  const buttons = [
    commandButton(editor, "bold", "Bold", () => run(editor, "toggleBold"), () => editor.isActive("bold")),
    commandButton(editor, "italic", "Italic", () => run(editor, "toggleItalic"), () => editor.isActive("italic")),
    commandButton(editor, "underline", "Underline", () => run(editor, "toggleUnderline"), () => editor.isActive("underline")),
    commandButton(editor, "strike", "Strike-through", () => run(editor, "toggleStrike"), () => editor.isActive("strike")),
  ];
  return buttons;
}

function linkButton(editor: EditorInstance): HTMLButtonElement {
  return commandButton(editor, "link", "Link", () => {
    if (editor.isActive("link")) return run(editor, "unsetLink");
    const href = window.prompt("Link URL", "https://");
    return href ? run(editor, "setLink", { href }) : false;
  }, () => editor.isActive("link"));
}

const COLOR_SPECS: ColorSpec[] = [
  { label: "Text color", icon: "textColor", mark: "text_color", set: "setTextColor", unset: "unsetTextColor" },
  { label: "Fill", icon: "background", mark: "background_color", set: "setBackgroundColor", unset: "unsetBackgroundColor", textOn: "Text on fill" },
  { label: "Highlight", icon: "highlight", mark: "highlight", set: "setHighlight", unset: "unsetHighlight", textOn: "Text on highlight" },
  { label: "Underline color", icon: "underlineColor", mark: "underline", set: "setUnderlineColor", unset: "unsetUnderlineColor" },
]

function colorDropdowns(editor: EditorInstance, marks: string[]): HTMLElement[] {
  return COLOR_SPECS
    .filter((spec) => marks.includes(spec.mark) && hasCommand(editor, spec.set) && hasCommand(editor, spec.unset))
    .map((spec) => colorDropdown(editor, spec));
}

function buildToolbar(editor: EditorInstance, kit: string, uploadUrl?: string): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "smeditor-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "SMEditor toolbar");
  toolbar.setAttribute("aria-orientation", "horizontal");

  const controls: HTMLElement[] = [];
  const add = (...els: HTMLElement[]) => { toolbar.append(...els); controls.push(...els); };

  const undo = commandButton(editor, "undo", "Undo", () => run(editor, "undo"));
  const redo = commandButton(editor, "redo", "Redo", () => run(editor, "redo"));
  add(undo, redo, divider());

  const block = dropdown("Block type", svgIcon("heading"), () => {
    const items: DropdownItemSpec[] = [{ label: "Paragraph", icon: "paragraph", active: () => editor.isActive("paragraph"), action: () => run(editor, "setParagraph") }];
    for (let level = 1; level <= 6; level++) items.push({ label: `Heading ${level}`, icon: "heading", shortcut: `⌘⌥${level}`, active: () => editor.isActive("heading", { level }), action: () => run(editor, "setHeading", { level }), separatorBefore: level === 1 });
    items.push({ label: "Quote", icon: "blockquote", active: () => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), "blockquote"), action: () => run(editor, "toggleBlockquote"), separatorBefore: true });
    items.push({ label: "Code block", icon: "codeBlock", active: () => editor.isActive("code_block"), action: () => run(editor, "setCodeBlock") });
    return items;
  }, { summary: () => blockTypeSummary(editor) });

  const lists = dropdown("Lists", svgIcon("bullet"), () => [
    { label: "Bullet List", icon: "bullet", shortcut: "⌘⇧8", active: () => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), "bullet_list"), action: () => run(editor, "toggleBulletList") },
    { label: "Ordered List", icon: "ordered", shortcut: "⌘⇧7", active: () => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), "ordered_list"), action: () => run(editor, "toggleOrderedList") },
    { label: "Task List", icon: "task", shortcut: "⌘⇧9", active: () => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), "task_list"), action: () => run(editor, "toggleTaskList") },
  ], {
    icon: () => currentListIcon(editor),
    active: () => ["bullet_list", "ordered_list", "task_list"].some((name) => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), name)),
  });
  add(block, lists, divider());

  add(
    ...inlineMarkButtons(editor),
    commandButton(editor, "eraser", "Clear formatting", () => run(editor, "clearFormatting")),
    linkButton(editor),
    divider(),
  );

  const alignItem = (label: string, icon: string, align: string) => ({
    label, icon, active: () => currentAlign(editor) === align, action: () => run(editor, "setTextAlign", { align }),
  });
  const align = dropdown("Alignment", svgIcon("alignLeft"), () => [
    alignItem("Left", "alignLeft", "left"),
    alignItem("Center", "alignCenter", "center"),
    alignItem("Right", "alignRight", "right"),
    alignItem("Justify", "alignJustify", "justify"),
    { label: "Increase indent", icon: "indent", action: () => run(editor, "indent"), separatorBefore: true },
    { label: "Decrease indent", icon: "outdent", action: () => run(editor, "outdent") },
  ], {
    icon: () => ({ center: "alignCenter", right: "alignRight", justify: "alignJustify" } as Record<string, string>)[currentAlign(editor)] ?? "alignLeft",
    active: () => currentAlign(editor) !== "left",
  });
  add(align, divider());

  add(
    commandButton(editor, "blockquote", "Blockquote", () => run(editor, "toggleBlockquote"), () => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), "blockquote")),
    commandButton(editor, "codeBlock", "Code block", () => run(editor, "setCodeBlock"), () => editor.isActive("code_block")),
    commandButton(editor, "hr", "Horizontal rule", () => run(editor, "insertHorizontalRule")),
  );

  const image = dropdown("Insert image", svgIcon("image"), () => {
    const items: DropdownItemSpec[] = [{ label: "From URL…", icon: "link", action: () => {
      const src = window.prompt("Image URL", "https://");
      if (!src) return;
      const alt = window.prompt("Alt text (optional)", "") ?? "";
      run(editor, "insertImage", { src, alt: alt || undefined });
    }}];
    if (uploadUrl && hasCommand(editor, "uploadImage")) items.push({ label: "Upload image…", icon: "image", action: () => {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      input.onchange = () => { const file = input.files?.[0]; if (file) run(editor, "uploadImage", file); };
      input.click();
    }});
    return items;
  });
  add(image, tablePicker(editor));

  if (kit === "full") {
    add(divider());
    add(...colorDropdowns(editor, ["text_color", "background_color", "highlight", "underline"]));
    add(
      valueDropdown({
        ariaLabel: "Font family",
        placeholder: "Font",
        values: [["Default", null], ["Sans-serif", "ui-sans-serif, system-ui, sans-serif"], ["Serif", "ui-serif, Georgia, serif"], ["Monospace", "ui-monospace, Menlo, monospace"], ["Georgia", "Georgia, serif"], ["Courier", "'Courier New', monospace"]],
        current: () => markValue(editor, "font_family", "family"),
        apply: (value) => (value === null ? run(editor, "unsetFontFamily") : run(editor, "setFontFamily", { family: value })),
      }),
      valueDropdown({
        ariaLabel: "Font size",
        placeholder: "Size",
        showValue: true,
        values: [["Default", null], ["Small · 13px", "13px"], ["Normal · 16px", "16px"], ["Large · 20px", "20px"], ["Huge · 28px", "28px"]],
        current: () => markValue(editor, "font_size", "size"),
        apply: (value) => (value === null ? run(editor, "unsetFontSize") : run(editor, "setFontSize", { size: value })),
      }),
      valueDropdown({
        ariaLabel: "Line height",
        placeholder: "Spacing",
        showValue: true,
        values: [["Default", null], ["Tight · 1", "1"], ["Snug · 1.15", "1.15"], ["Normal · 1.5", "1.5"], ["Relaxed · 2", "2"]],
        current: () => blockValue(editor, "lineHeight"),
        apply: (value) => run(editor, "setLineHeight", { value }),
      }),
    );

    if (hasCommand(editor, "addComment")) {
      add(commandButton(editor, "", "Comment", () => {
        const body = window.prompt("New comment");
        if (!body) return false;
        return run(editor, "addComment", { threadId: `comment-${Date.now()}` });
      }, undefined, "Comment"));
    }

    const more = dropdown("More tools", svgIcon("more"), () => [
      { label: "Inline code", icon: "code", shortcut: "⌘E", active: () => editor.isActive("code"), action: () => run(editor, "toggleCode") },
      { label: "Subscript", icon: "subscript", active: () => editor.isActive("subscript"), action: () => run(editor, "toggleSubscript"), separatorBefore: true },
      { label: "Superscript", icon: "superscript", active: () => editor.isActive("superscript"), action: () => run(editor, "toggleSuperscript") },
      { label: "Increase indent", icon: "indent", action: () => run(editor, "indent"), separatorBefore: true },
      { label: "Decrease indent", icon: "outdent", action: () => run(editor, "outdent") },
    ], { align: "right", active: () => ["code", "subscript", "superscript"].some((mark) => editor.isActive(mark)) });
    add(more);
  }

  const refresh = () => {
    undo.toggleAttribute("disabled", !editor.canUndo());
    redo.toggleAttribute("disabled", !editor.canRedo());
    for (const control of controls) (control as any).__smeditorRefresh?.();
  };
  const disposeUpdate = editor.on("update", refresh);
  const disposeSelection = editor.on("selectionUpdate", refresh);
  queueMicrotask(refresh);
  (toolbar as any).__smeditorDispose = () => {
    disposeUpdate(); disposeSelection();
    for (const control of controls) (control as any).__smeditorDispose?.();
  };
  return toolbar;
}

function selectionForSurface(surface: HTMLElement): Selection | null {
  const root = surface.getRootNode?.();
  const getSelection = (root as { getSelection?: () => Selection | null } | null)?.getSelection;
  if (root && typeof getSelection === "function") {
    const selection = getSelection.call(root);
    if (selection) return selection;
  }
  return surface.ownerDocument?.getSelection?.() ?? null;
}

/**
 * Rails uses a dependency-free browser adapter rather than the React package,
 * so contextual UI that exists in the playground must be mounted explicitly.
 * This mirrors React's <BubbleMenu />: selecting non-empty text opens a small
 * formatting toolbar above the live DOM range.
 */
function buildBubbleMenu(editor: EditorInstance, surface: HTMLElement, container: HTMLElement): HTMLDivElement {
  const menu = document.createElement("div");
  menu.className = "smeditor-floating smeditor-bubble-menu";
  menu.setAttribute("role", "toolbar");
  menu.setAttribute("aria-label", "Selected text formatting");
  // Keep the popover in the editor's own coordinate space. `position: fixed`
  // becomes relative to transformed/filtering ancestors in browsers, which can
  // shove the menu to the right or down in host applications. Absolute local
  // positioning is stable because both the selection and container are measured
  // in viewport coordinates and then converted to editor-local coordinates.
  menu.style.position = "absolute";
  menu.style.display = "none";
  menu.style.zIndex = "2147483000";

  // Same controls (and the same live state) as the matching toolbar ones:
  // inline marks, link, the colour pickers the kit provides, and a clear
  // button that removes every inline style from the selection at once.
  const buttons: HTMLElement[] = [...inlineMarkButtons(editor)];
  if (hasCommand(editor, "toggleCode")) {
    buttons.push(commandButton(editor, "code", "Inline code", () => run(editor, "toggleCode"), () => editor.isActive("code")));
  }
  buttons.push(linkButton(editor));
  const colors = colorDropdowns(editor, ["text_color", "background_color", "underline"]);
  if (colors.length) buttons.push(divider(), ...colors);
  if (hasCommand(editor, "clearFormatting")) {
    buttons.push(divider(), commandButton(editor, "eraser", "Clear formatting", () => run(editor, "clearFormatting")));
  }
  menu.append(...buttons);

  // Keeping pointer-down inside the menu from focusing a button preserves the
  // editor's text selection, which the formatting command needs.
  menu.addEventListener("mousedown", (event) => event.preventDefault());

  let frame = 0;
  const hide = () => {
    for (const button of buttons) (button as any).__smeditorClose?.();
    menu.style.display = "none";
    menu.style.visibility = "hidden";
  };
  const updateNow = () => {
    frame = 0;
    if (surface.getAttribute("contenteditable") === "false") return hide();

    const selection = selectionForSurface(surface);
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return hide();

    const range = selection.getRangeAt(0);
    if (!surface.contains(range.commonAncestorContainer)) return hide();

    const anchor = range.getBoundingClientRect();
    if (anchor.width === 0 && anchor.height === 0) return hide();

    for (const button of buttons) (button as any).__smeditorRefresh?.();

    // Make it measurable off-screen, then place it before the next paint.
    menu.style.display = "inline-flex";
    menu.style.visibility = "hidden";
    menu.style.left = "-9999px";
    menu.style.top = "-9999px";

    const rect = menu.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const margin = 8;
    const offset = 8;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Calculate the desired position in viewport coordinates first, exactly like
    // the React playground's Floating primitive, including viewport clamping and
    // top/bottom collision handling. Then translate that point into the local
    // coordinate system of the editor shell. This survives transformed parents,
    // zoomed panels, modals, sidebars and other containing-block creators.
    let viewportLeft = anchor.left + anchor.width / 2 - rect.width / 2;
    const maxViewportLeft = Math.max(margin, viewportWidth - rect.width - margin);
    viewportLeft = Math.max(margin, Math.min(viewportLeft, maxViewportLeft));

    // Never cover the main toolbar: when there is no room between the top
    // of the writing surface and the selection, open below the selection.
    const topLimit = Math.max(margin, surface.getBoundingClientRect().top);
    let viewportTop = anchor.top - rect.height - offset;
    if (viewportTop < topLimit) viewportTop = anchor.bottom + offset;
    if (viewportTop + rect.height > viewportHeight - margin) {
      viewportTop = Math.max(margin, anchor.top - rect.height - offset);
    }

    menu.style.left = `${Math.round(viewportLeft - containerRect.left)}px`;
    menu.style.top = `${Math.round(viewportTop - containerRect.top)}px`;
    menu.style.visibility = "visible";
  };
  const scheduleUpdate = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(updateNow);
  };

  const selectionRoot = surface.getRootNode?.();
  const selectionTarget = selectionRoot && selectionRoot !== document
    ? selectionRoot as EventTarget
    : null;

  const hideOnBlur = () => requestAnimationFrame(() => {
    const active = (surface.getRootNode() as Document | ShadowRoot).activeElement;
    if (active !== surface && !menu.contains(active)) hide();
  });
  const disposeSelection = editor.on("selectionUpdate", scheduleUpdate);
  const disposeUpdate = editor.on("update", scheduleUpdate);
  surface.addEventListener("blur", hideOnBlur);
  document.addEventListener("selectionchange", scheduleUpdate);
  selectionTarget?.addEventListener("selectionchange", scheduleUpdate);
  surface.addEventListener("pointerup", scheduleUpdate);
  surface.addEventListener("keyup", scheduleUpdate);
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("scroll", scheduleUpdate, true);

  (menu as any).__smeditorDispose = () => {
    if (frame) cancelAnimationFrame(frame);
    disposeSelection();
    disposeUpdate();
    surface.removeEventListener("blur", hideOnBlur);
    for (const button of buttons) (button as any).__smeditorDispose?.();
    document.removeEventListener("selectionchange", scheduleUpdate);
    selectionTarget?.removeEventListener("selectionchange", scheduleUpdate);
    surface.removeEventListener("pointerup", scheduleUpdate);
    surface.removeEventListener("keyup", scheduleUpdate);
    window.removeEventListener("resize", scheduleUpdate);
    window.removeEventListener("scroll", scheduleUpdate, true);
  };

  return menu;
}

function shadowRootFor(mount: SMMount): ShadowRoot {
  const root = mount.shadowRoot || mount.attachShadow({ mode: "open" });
  root.innerHTML = "";
  const stylesheet = mount.dataset.smeditorStylesheet;
  if (stylesheet) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = stylesheet;
    root.appendChild(link);
  }
  return root;
}

function bootMount(mount: SMMount): void {
  if (instances.has(mount)) return;
  const field = mount.closest<HTMLElement>(".smeditor-field");
  const input = field?.querySelector<SMInput>("[data-smeditor-input]");
  if (!field || !input) return;

  const kit = mount.dataset.smeditorKit === "full" ? "full" : "starter";
  const uploadUrl = mount.dataset.smeditorUploadUrl || undefined;
  const placeholder = mount.dataset.smeditorPlaceholder || undefined;
  const configuredTheme = mount.dataset.smeditorTheme;
  const inheritedTheme = mount.parentElement?.closest<HTMLElement>("[data-theme]")?.dataset.theme
    || document.documentElement.dataset.theme;
  const theme = configuredTheme === "dark" || configuredTheme === "light"
    ? configuredTheme
    : inheritedTheme === "dark" || inheritedTheme === "light"
      ? inheritedTheme
      : "light";
  mount.dataset.theme = theme;
  const root = shadowRootFor(mount);

  const shell = document.createElement("div");
  shell.className = "smeditor";
  const responsiveHeights: Array<[string, string | undefined]> = [
    ["--sme-editor-min-height", mount.dataset.smeditorMinHeight],
    ["--sme-editor-min-height-tablet", mount.dataset.smeditorTabletMinHeight],
    ["--sme-editor-min-height-mobile", mount.dataset.smeditorMobileMinHeight],
  ];
  for (const [property, value] of responsiveHeights) {
    if (value) shell.style.setProperty(property, value);
  }
  const surface = document.createElement("div");
  surface.className = "smeditor-editor";
  surface.setAttribute("aria-label", mount.dataset.smeditorLabel || "Rich text editor");
  shell.appendChild(surface);
  root.appendChild(shell);

  const editor = createEditor({
    element: surface,
    extensions: kitExtensions(kit, uploadUrl),
    content: input.value || "<p></p>",
    placeholder,
    theme,
    deepSelection: true,
    onUpdate: ({ editor: current }) => {
      input.value = current.getHTML();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new CustomEvent("smeditor:change", { bubbles: true, detail: { editor: current } }));
    },
  });

  const toolbar = buildToolbar(editor, kit, uploadUrl);
  shell.insertBefore(toolbar, surface);
  const bubbleMenu = buildBubbleMenu(editor, surface, shell);
  shell.appendChild(bubbleMenu);
  input.smeditorInstance = editor;
  mount.smeditorInstance = editor;
  mount.dataset.smeditorBooted = "1";
  instances.set(mount, editor);
  disposers.set(mount, [
    () => (toolbar as any).__smeditorDispose?.(),
    () => (bubbleMenu as any).__smeditorDispose?.(),
  ]);
}

export function boot(root: ParentNode = document): void {
  root.querySelectorAll<SMMount>("[data-smeditor]").forEach(bootMount);
}

export function destroy(root: ParentNode = document): void {
  root.querySelectorAll<SMMount>("[data-smeditor]").forEach((mount) => {
    const editor = instances.get(mount);
    if (!editor) return;
    for (const dispose of disposers.get(mount) ?? []) dispose();
    disposers.delete(mount);
    editor.destroy();
    const field = mount.closest<HTMLElement>(".smeditor-field");
    const input = field?.querySelector<SMInput>("[data-smeditor-input]");
    if (input) delete input.smeditorInstance;
    delete mount.smeditorInstance;
    delete mount.dataset.smeditorBooted;
    instances.delete(mount);
    if (mount.shadowRoot) mount.shadowRoot.innerHTML = "";
  });
}

const api = { boot, destroy, createEditor, StarterKit, FullKit, ImageExtension };

declare global {
  interface Window { SMEditor?: typeof api; __smeditorRailsEventsBound?: boolean; }
}

if (typeof window !== "undefined") {
  window.SMEditor = Object.assign(window.SMEditor || {}, api);
  if (!window.__smeditorRailsEventsBound) {
    window.__smeditorRailsEventsBound = true;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => window.SMEditor?.boot());
    else boot();
    document.addEventListener("turbo:load", () => window.SMEditor?.boot());
    document.addEventListener("turbo:frame-load", (event) => window.SMEditor?.boot((event.target as ParentNode) || document));
    document.addEventListener("turbo:before-cache", () => window.SMEditor?.destroy());
  } else {
    boot();
  }
}
