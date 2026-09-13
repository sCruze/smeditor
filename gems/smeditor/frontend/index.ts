import {
  createEditor,
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
  highlight: '<path d="M3 13l3-1 6-6-2-2-6 6z"/><path d="M2 14h12"/>',
  textColor: '<text x="3" y="11" font-size="9" font-weight="700" fill="currentColor" stroke="none">A</text><rect x="3" y="13" width="10" height="2" fill="currentColor" stroke="none"/>',
  background: '<rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 2l12 12"/>',
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
    extension.name === "image" ? ImageExtension.configure({ upload }) : extension,
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
    }
  };
  (el as any).__smeditorRefresh = refresh;
  refresh();
  return el;
}

function dropdown(
  ariaLabel: string,
  triggerContent: HTMLElement | string,
  items: () => DropdownItemSpec[],
  options: { summary?: () => string; active?: () => boolean; align?: "left" | "right" } = {},
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
  if (typeof triggerContent === "string") label.textContent = triggerContent;
  else label.appendChild(triggerContent);
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
    for (const spec of items()) {
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
    if (options.active) {
      const value = options.active();
      trigger.dataset.active = value ? "true" : "false";
      trigger.classList.toggle("is-active", value);
    }
  };
  (wrapper as any).__smeditorRefresh = refresh;
  (wrapper as any).__smeditorDispose = () => document.removeEventListener("pointerdown", outside, true);
  refresh();
  return wrapper;
}

function colorDropdown(
  editor: EditorInstance,
  ariaLabel: string,
  iconName: string,
  markName: string,
  setCommand: string,
  unsetCommand: string,
  extraAttrs: Record<string, unknown> = {},
): HTMLElement {
  const colors = [
    "#1a1a1f", "#6b7280", "#ef4444", "#f97316", "#eab308",
    "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
    "#ffffff", "#d1d5db", "#fecaca", "#fed7aa", "#fef08a",
    "#bbf7d0", "#a5f3fc", "#bfdbfe", "#ddd6fe", "#fbcfe8",
  ];
  return dropdown(ariaLabel, svgIcon(iconName), () => {
    const grid = document.createElement("div");
    grid.className = "smeditor-color-grid";
    grid.setAttribute("role", "group");
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "smeditor-color-grid__swatch smeditor-color-grid__swatch--clear";
    clear.title = `Clear ${ariaLabel.toLowerCase()}`;
    clear.setAttribute("aria-label", clear.title);
    clear.addEventListener("mousedown", (e) => e.preventDefault());
    clear.addEventListener("click", () => run(editor, unsetCommand));
    grid.appendChild(clear);
    for (const color of colors) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.className = "smeditor-color-grid__swatch";
      swatch.style.backgroundColor = color;
      swatch.title = color;
      swatch.setAttribute("aria-label", `${ariaLabel}: ${color}`);
      swatch.addEventListener("mousedown", (e) => e.preventDefault());
      swatch.addEventListener("click", () => run(editor, setCommand, { color, ...extraAttrs }));
      grid.appendChild(swatch);
    }
    return [{ label: "", content: grid }];
  }, { active: () => editor.isActive(markName) });
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

function textDropdown(editor: EditorInstance, ariaLabel: string, label: string, values: Array<[string, string | null]>, command: string, unset?: string): HTMLElement {
  return dropdown(ariaLabel, label, () => values.map(([text, value]) => ({
    label: text,
    action: () => value === null && unset ? run(editor, unset) : run(editor, command, { [command === "setFontFamily" ? "family" : command === "setFontSize" ? "size" : "value"]: value }),
  })));
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
  ], { active: () => ["bullet_list", "ordered_list", "task_list"].some((name) => selectionInsideWrapper(editor.getJSON(), editor.getSelection(), name)) });
  add(block, lists, divider());

  add(
    commandButton(editor, "bold", "Bold", () => run(editor, "toggleBold"), () => editor.isActive("bold")),
    commandButton(editor, "italic", "Italic", () => run(editor, "toggleItalic"), () => editor.isActive("italic")),
    commandButton(editor, "strike", "Strike-through", () => run(editor, "toggleStrike"), () => editor.isActive("strike")),
    commandButton(editor, "underline", "Underline", () => run(editor, "toggleUnderline"), () => editor.isActive("underline")),
    commandButton(editor, "eraser", "Clear formatting", () => run(editor, "clearFormatting")),
    commandButton(editor, "link", "Link", () => {
      if (editor.isActive("link")) return run(editor, "unsetLink");
      const href = window.prompt("Link URL", "https://");
      return href ? run(editor, "setLink", { href }) : false;
    }, () => editor.isActive("link")),
    divider(),
  );

  const align = dropdown("Alignment", svgIcon("alignLeft"), () => [
    { label: "Left", icon: "alignLeft", active: () => editor.isActive("text_align", { align: "left" }), action: () => run(editor, "setTextAlign", { align: "left" }) },
    { label: "Center", icon: "alignCenter", active: () => editor.isActive("text_align", { align: "center" }), action: () => run(editor, "setTextAlign", { align: "center" }) },
    { label: "Right", icon: "alignRight", active: () => editor.isActive("text_align", { align: "right" }), action: () => run(editor, "setTextAlign", { align: "right" }) },
    { label: "Justify", icon: "alignJustify", active: () => editor.isActive("text_align", { align: "justify" }), action: () => run(editor, "setTextAlign", { align: "justify" }) },
    { label: "Increase indent", icon: "indent", action: () => run(editor, "indent"), separatorBefore: true },
    { label: "Decrease indent", icon: "outdent", action: () => run(editor, "outdent") },
  ]);
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
    add(
      colorDropdown(editor, "Highlight", "highlight", "highlight", "setHighlight", "unsetHighlight"),
      colorDropdown(editor, "Text color", "textColor", "text_color", "setTextColor", "unsetTextColor"),
      colorDropdown(editor, "Text stroke", "textColor", "text_stroke", "setTextStroke", "unsetTextStroke", { width: 1 }),
      colorDropdown(editor, "Background color", "background", "background_color", "setBackgroundColor", "unsetBackgroundColor"),
      textDropdown(editor, "Font family", "Font", [["Default", null], ["Sans-serif", "ui-sans-serif, system-ui, sans-serif"], ["Serif", "ui-serif, Georgia, serif"], ["Monospace", "ui-monospace, Menlo, monospace"], ["Georgia", "Georgia, serif"], ["Courier", "'Courier New', monospace"]], "setFontFamily", "unsetFontFamily"),
      textDropdown(editor, "Font size", "Size", [["Default", null], ["Small · 13px", "13px"], ["Normal · 16px", "16px"], ["Large · 20px", "20px"], ["Huge · 28px", "28px"]], "setFontSize", "unsetFontSize"),
      textDropdown(editor, "Line height", "Spacing", [["Default", null], ["Tight · 1", "1"], ["Snug · 1.15", "1.15"], ["Normal · 1.5", "1.5"], ["Relaxed · 2", "2"]], "setLineHeight"),
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
    ], { align: "right" });
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

  const buttons = [
    commandButton(editor, "bold", "Bold", () => run(editor, "toggleBold"), () => editor.isActive("bold")),
    commandButton(editor, "italic", "Italic", () => run(editor, "toggleItalic"), () => editor.isActive("italic")),
    commandButton(editor, "underline", "Underline", () => run(editor, "toggleUnderline"), () => editor.isActive("underline")),
    commandButton(editor, "strike", "Strike-through", () => run(editor, "toggleStrike"), () => editor.isActive("strike")),
    commandButton(editor, "link", "Link", () => {
      if (editor.isActive("link")) return run(editor, "unsetLink");
      const href = window.prompt("Link URL", "https://");
      return href ? run(editor, "setLink", { href }) : false;
    }, () => editor.isActive("link")),
  ];
  menu.append(...buttons);

  // Keeping pointer-down inside the menu from focusing a button preserves the
  // editor's text selection, which the formatting command needs.
  menu.addEventListener("mousedown", (event) => event.preventDefault());

  let frame = 0;
  const hide = () => {
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

    let viewportTop = anchor.top - rect.height - offset;
    if (viewportTop < margin) viewportTop = anchor.bottom + offset;
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

  const disposeSelection = editor.on("selectionUpdate", scheduleUpdate);
  document.addEventListener("selectionchange", scheduleUpdate);
  selectionTarget?.addEventListener("selectionchange", scheduleUpdate);
  surface.addEventListener("pointerup", scheduleUpdate);
  surface.addEventListener("keyup", scheduleUpdate);
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("scroll", scheduleUpdate, true);

  (menu as any).__smeditorDispose = () => {
    if (frame) cancelAnimationFrame(frame);
    disposeSelection();
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
