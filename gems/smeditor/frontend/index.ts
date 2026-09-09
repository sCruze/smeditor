import { createEditor, type EditorInstance, type Extension } from "@smeditor/core";
import { StarterKit, ImageExtension } from "@smeditor/starter-kit";
import { FullKit } from "@smeditor/full-kit";

type SMInput = HTMLInputElement & { smeditorInstance?: EditorInstance };
type SMMount = HTMLElement & { smeditorInstance?: EditorInstance };

const instances = new Map<HTMLElement, EditorInstance>();
const disposers = new Map<HTMLElement, Array<() => void>>();

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

function button(label: string, title: string, action: () => boolean | void): HTMLButtonElement {
  const el = document.createElement("button");
  el.type = "button";
  el.className = "smeditor-button";
  el.textContent = label;
  el.title = title;
  el.setAttribute("aria-label", title);
  el.addEventListener("mousedown", (event) => event.preventDefault());
  el.addEventListener("click", () => action());
  return el;
}

function divider(): HTMLSpanElement {
  const el = document.createElement("span");
  el.className = "smeditor-toolbar__divider";
  el.setAttribute("role", "separator");
  el.setAttribute("aria-hidden", "true");
  return el;
}

function selectControl(label: string, options: Array<[string, string]>, onChange: (value: string) => void): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "smeditor-select";
  select.title = label;
  select.setAttribute("aria-label", label);
  for (const [value, text] of options) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }
  select.addEventListener("change", () => {
    onChange(select.value);
    select.value = "";
  });
  return select;
}

function run(editor: EditorInstance, command: string, ...args: unknown[]): boolean {
  const fn = editor.commands[command];
  if (typeof fn !== "function") return false;
  const result = fn(...args);
  editor.focus();
  return Boolean(result);
}

function activeButton(editor: EditorInstance, el: HTMLButtonElement, name: string, attrs?: Record<string, unknown>) {
  el.dataset.active = editor.isActive(name, attrs) ? "true" : "false";
}

function buildToolbar(editor: EditorInstance, kit: string, uploadUrl?: string): HTMLElement {
  const toolbar = document.createElement("div");
  toolbar.className = "smeditor-toolbar";
  toolbar.setAttribute("role", "toolbar");
  toolbar.setAttribute("aria-label", "SMEditor toolbar");

  const undo = button("↶", "Undo", () => run(editor, "undo"));
  const redo = button("↷", "Redo", () => run(editor, "redo"));
  toolbar.append(undo, redo, divider());

  const block = selectControl("Block type", [
    ["", "Block"], ["p", "Paragraph"], ["h1", "Heading 1"], ["h2", "Heading 2"],
    ["h3", "Heading 3"], ["h4", "Heading 4"], ["quote", "Blockquote"], ["code", "Code block"],
  ], (value) => {
    if (value === "p") run(editor, "setParagraph");
    else if (/^h[1-6]$/.test(value)) run(editor, "setHeading", { level: Number(value.slice(1)) });
    else if (value === "quote") run(editor, "toggleBlockquote");
    else if (value === "code") run(editor, "setCodeBlock");
  });
  toolbar.append(block, divider());

  const bold = button("B", "Bold", () => run(editor, "toggleBold"));
  const italic = button("I", "Italic", () => run(editor, "toggleItalic"));
  const underline = button("U", "Underline", () => run(editor, "toggleUnderline"));
  const strike = button("S", "Strike", () => run(editor, "toggleStrike"));
  bold.style.fontWeight = "700";
  italic.style.fontStyle = "italic";
  underline.style.textDecoration = "underline";
  strike.style.textDecoration = "line-through";
  toolbar.append(bold, italic, underline, strike);

  if (kit === "full") {
    const inlineCode = button("</>", "Inline code", () => run(editor, "toggleCode"));
    const sub = button("x₂", "Subscript", () => run(editor, "toggleSubscript"));
    const sup = button("x²", "Superscript", () => run(editor, "toggleSuperscript"));
    toolbar.append(inlineCode, sub, sup);
  }

  const clear = button("Tx", "Clear formatting", () => run(editor, "clearFormatting"));
  const link = button("🔗", "Link", () => {
    if (editor.isActive("link")) return run(editor, "unsetLink");
    const href = window.prompt("Link URL", "https://");
    if (href) return run(editor, "setLink", { href });
  });
  toolbar.append(clear, link, divider());

  const list = selectControl("List", [["", "List"], ["bullet", "Bulleted"], ["ordered", "Numbered"], ["task", "Task list"]], (value) => {
    if (value === "bullet") run(editor, "toggleBulletList");
    if (value === "ordered") run(editor, "toggleOrderedList");
    if (value === "task") run(editor, "toggleTaskList");
  });
  const align = selectControl("Alignment", [["", "Align"], ["left", "Left"], ["center", "Center"], ["right", "Right"], ["justify", "Justify"]], (value) => {
    if (value) run(editor, "setTextAlign", { align: value });
  });
  toolbar.append(list, align, divider());

  toolbar.append(
    button("❝", "Blockquote", () => run(editor, "toggleBlockquote")),
    button("{ }", "Code block", () => run(editor, "setCodeBlock")),
    button("―", "Horizontal rule", () => run(editor, "insertHorizontalRule")),
  );

  const image = button("Image", "Insert image by URL", () => {
    const src = window.prompt("Image URL", "https://");
    if (src) run(editor, "insertImage", { src });
  });
  toolbar.append(image);

  if (uploadUrl && typeof editor.commands.uploadImage === "function") {
    const file = document.createElement("input");
    file.type = "file";
    file.accept = "image/*";
    file.className = "smeditor-file-input";
    file.tabIndex = -1;
    file.setAttribute("aria-hidden", "true");
    const upload = button("Upload", "Upload image", () => file.click());
    file.addEventListener("change", () => {
      const selected = file.files?.[0];
      if (selected) run(editor, "uploadImage", selected);
      file.value = "";
    });
    toolbar.append(upload, file);
  }

  toolbar.append(button("Table", "Insert table", () => {
    const rows = Number(window.prompt("Rows", "3") || "3");
    const cols = Number(window.prompt("Columns", "3") || "3");
    run(editor, "insertTable", { rows, cols, withHeaderRow: true });
  }));

  if (kit === "full") {
    toolbar.append(divider());
    const font = selectControl("Font family", [
      ["", "Font"], ["Arial", "Arial"], ["Georgia", "Georgia"], ["Times New Roman", "Times"],
      ["Verdana", "Verdana"], ["Courier New", "Courier"],
    ], (value) => value && run(editor, "setFontFamily", { family: value }));
    const size = selectControl("Font size", [["", "Size"], ["12px", "12"], ["14px", "14"], ["16px", "16"], ["18px", "18"], ["24px", "24"], ["32px", "32"]],
      (value) => value && run(editor, "setFontSize", { size: value }));
    const line = selectControl("Line height", [["", "Line"], ["1", "1.0"], ["1.25", "1.25"], ["1.5", "1.5"], ["1.75", "1.75"], ["2", "2.0"]],
      (value) => value && run(editor, "setLineHeight", { value }));
    toolbar.append(font, size, line);

    const textColor = document.createElement("input");
    textColor.type = "color";
    textColor.className = "smeditor-color-input";
    textColor.title = "Text color";
    textColor.setAttribute("aria-label", "Text color");
    textColor.addEventListener("input", () => run(editor, "setTextColor", { color: textColor.value }));

    const bgColor = document.createElement("input");
    bgColor.type = "color";
    bgColor.className = "smeditor-color-input";
    bgColor.title = "Background color";
    bgColor.setAttribute("aria-label", "Background color");
    bgColor.addEventListener("input", () => run(editor, "setBackgroundColor", { color: bgColor.value }));
    toolbar.append(textColor, bgColor);
  }

  const updateState = () => {
    undo.disabled = !editor.canUndo();
    redo.disabled = !editor.canRedo();
    activeButton(editor, bold, "bold");
    activeButton(editor, italic, "italic");
    activeButton(editor, underline, "underline");
    activeButton(editor, strike, "strike");
    link.dataset.active = editor.isActive("link") ? "true" : "false";
  };
  const disposeUpdate = editor.on("update", updateState);
  const disposeSelection = editor.on("selectionUpdate", updateState);
  queueMicrotask(updateState);

  const listForMount = disposers.get(editor.element as HTMLElement) ?? [];
  listForMount.push(disposeUpdate, disposeSelection);
  disposers.set(editor.element as HTMLElement, listForMount);
  return toolbar;
}

function bootMount(mount: SMMount): void {
  if (instances.has(mount)) return;
  if (mount.smeditorInstance) {
    instances.set(mount, mount.smeditorInstance);
    return;
  }
  const field = mount.closest<HTMLElement>(".smeditor-field");
  const input = field?.querySelector<SMInput>("[data-smeditor-input]");
  if (!field || !input) return;

  const kit = mount.dataset.smeditorKit === "full" ? "full" : "starter";
  const uploadUrl = mount.dataset.smeditorUploadUrl || undefined;
  const placeholder = mount.dataset.smeditorPlaceholder || undefined;

  mount.innerHTML = "";
  const shell = document.createElement("div");
  shell.className = "smeditor";
  const surface = document.createElement("div");
  surface.className = "smeditor-editor";
  surface.setAttribute("aria-label", mount.dataset.smeditorLabel || "Rich text editor");
  shell.appendChild(surface);
  mount.appendChild(shell);

  const editor = createEditor({
    element: surface,
    extensions: kitExtensions(kit, uploadUrl),
    content: input.value || "<p></p>",
    placeholder,
    deepSelection: true,
    onUpdate: ({ editor: current }) => {
      input.value = current.getHTML();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new CustomEvent("smeditor:change", { bubbles: true, detail: { editor: current } }));
    },
  });

  shell.insertBefore(buildToolbar(editor, kit, uploadUrl), surface);
  input.smeditorInstance = editor;
  mount.smeditorInstance = editor;
  mount.dataset.smeditorBooted = "1";
  instances.set(mount, editor);
}

export function boot(root: ParentNode = document): void {
  root.querySelectorAll<SMMount>("[data-smeditor]").forEach(bootMount);
}

export function destroy(root: ParentNode = document): void {
  root.querySelectorAll<SMMount>("[data-smeditor]").forEach((mount) => {
    const editor = instances.get(mount);
    if (!editor) return;
    const surface = editor.element as HTMLElement | null;
    if (surface) {
      for (const dispose of disposers.get(surface) ?? []) dispose();
      disposers.delete(surface);
    }
    editor.destroy();
    const field = mount.closest<HTMLElement>(".smeditor-field");
    const input = field?.querySelector<SMInput>("[data-smeditor-input]");
    if (input) delete input.smeditorInstance;
    delete mount.smeditorInstance;
    delete mount.dataset.smeditorBooted;
    instances.delete(mount);
    mount.innerHTML = "";
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
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => window.SMEditor?.boot());
    } else {
      boot();
    }
    document.addEventListener("turbo:load", () => window.SMEditor?.boot());
    document.addEventListener("turbo:frame-load", (event) => window.SMEditor?.boot((event.target as ParentNode) || document));
    document.addEventListener("turbo:before-cache", () => window.SMEditor?.destroy());
  } else {
    boot();
  }
}
