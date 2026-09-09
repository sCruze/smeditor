/**
 * SMEditor core types.
 *
 * These are the foundational data structures. Everything else in the engine
 * — schema, commands, transactions, extensions — operates on these.
 *
 * Design notes:
 *  - The document model is JSON-first. HTML is a serialization format,
 *    not the source of truth.
 *  - Nodes are either "block" (paragraph, heading, list_item, …) or
 *    "inline" (text). Marks are applied to text nodes.
 *  - All operations on the document go through a Transaction; the editor
 *    never mutates a document object in place from the outside.
 */

/** A mark applied to a span of text (bold, italic, link, …). */
export interface Mark {
  /** Mark name, e.g. "bold". Matches the `name` of a mark extension. */
  type: string;
  /** Optional mark attributes (e.g. link href). */
  attrs?: Record<string, unknown>;
}

/** A document node. Either a block (with `content`) or a text leaf. */
export interface DocumentNode {
  /** Node name, e.g. "doc", "paragraph", "heading", "text". */
  type: string;
  /** Inline text (only for `type === "text"`). */
  text?: string;
  /** Marks applied to a text node. */
  marks?: Mark[];
  /** Node attributes (e.g. heading level). */
  attrs?: Record<string, unknown>;
  /** Children for block nodes. */
  content?: DocumentNode[];
}

/** The root document. Always `{ type: "doc", content: [...] }`. */
export interface DocumentJSON extends DocumentNode {
  type: "doc";
  content: DocumentNode[];
}

/**
 * A selection range inside the document.
 * Positions are 0-based offsets within the text content of a node path.
 * The path is a list of indices from the root.
 *
 *   anchor — where selection started
 *   head   — where selection ended (caret position when collapsed)
 */
export interface EditorSelection {
  anchor: SelectionPoint;
  head: SelectionPoint;
}

export interface SelectionPoint {
  /** Path from doc root to the containing node (excluding the node itself). */
  path: number[];
  /** Offset inside the node. For text nodes, character offset. */
  offset: number;
}

/**
 * Schema entry describing a node type.
 * Extensions register one or more of these.
 */
export interface NodeSpec {
  name: string;
  /** "block" | "inline" — what role it plays in the document. */
  group: "block" | "inline";
  /** Content expression — describes which children may appear. Validation
   *  is informational for now; arbitrary strings like "list_item+" are
   *  accepted. */
  content?: string;
  /** When true, the parser treats the node as a leaf: it does not
   *  descend into the matched element's children. Use for nodes whose
   *  inner DOM is decoration (e.g. an image figure) and whose data
   *  comes entirely from `getAttrs`. */
  atom?: boolean;
  /** Default attributes. */
  attrs?: Record<string, NodeAttrSpec>;
  /** Render this node to an HTML element descriptor. */
  toDOM?: (node: DocumentNode) => DOMOutputSpec;
  /** Parse a DOM element into a node of this type. */
  parseDOM?: ParseRule[];
}

export interface NodeAttrSpec {
  default?: unknown;
}

/** Mark spec — describes a mark type (e.g. "bold"). */
export interface MarkSpec {
  name: string;
  /** Default attributes. */
  attrs?: Record<string, NodeAttrSpec>;
  /** Render mark to a wrapping HTML element. */
  toDOM?: (mark: Mark) => DOMOutputSpec;
  /** Parse DOM into a mark. */
  parseDOM?: ParseRule[];
  /** If true, two adjacent marks of this type with same attrs merge. */
  inclusive?: boolean;
}

/**
 * DOM output spec, modelled loosely on ProseMirror's format.
 *
 *   ["p", 0]                       → <p>{children}</p>
 *   ["a", { href: "..." }, 0]      → <a href="...">{children}</a>
 *   ["br"]                         → <br/>
 *   ["figure", {}, ["img", {…}], ["figcaption", {}, "text"]]
 *                                  → <figure><img …/><figcaption>text</figcaption></figure>
 *
 * The `0` is the "hole" — where children render. If absent, the element
 * has no children rendered into it (used for void/atomic nodes). A
 * child may also be a nested spec array or a literal string.
 */
export type DOMOutputSpecChild = 0 | string | DOMOutputSpec;

export type DOMOutputSpec =
  | [string]
  | [string, Record<string, string | number | boolean>]
  | [string, ...DOMOutputSpecChild[]]
  | [string, Record<string, string | number | boolean>, ...DOMOutputSpecChild[]];

export interface ParseRule {
  /** CSS-like tag selector, e.g. "p" or "h1". */
  tag?: string;
  /** Extract attributes from the matched DOM element. */
  getAttrs?: (el: HTMLElement) => Record<string, unknown> | false | null;
}

/** A command runs against an editor and returns true if it applied. */
export type Command = (editor: EditorInstance) => boolean;

/** Commands keyed by name, contributed by extensions. */
export type CommandMap = Record<string, (...args: any[]) => Command>;

/** Keyboard shortcut map: "Mod-b" → command. */
export type KeyboardShortcuts = Record<
  string,
  (editor: EditorInstance) => boolean
>;

/**
 * An extension contributes nodes, marks, commands, shortcuts, and
 * input rules to the editor. Extensions are the only way to add
 * functionality — core itself only registers the `doc` and `text` types.
 */
export interface Extension {
  /** Unique extension name. */
  name: string;
  /** Node specs contributed. */
  nodes?: NodeSpec[];
  /** Mark specs contributed. */
  marks?: MarkSpec[];
  /** Commands contributed. Each returns a Command thunk. */
  commands?: CommandMap;
  /** Keyboard shortcuts. */
  keyboardShortcuts?: KeyboardShortcuts;
  /** Input rules (e.g. "## " → heading). */
  inputRules?: InputRule[];
  /**
   * Transform pasted HTML. Runs after the editor's built-in
   * sanitizer; multiple extensions chain in registration order. Use
   * for source-specific cleanup (e.g. normalising Word list markup).
   */
  transformPastedHTML?: (html: string) => string;
  /**
   * Intercept typed text before it reaches the DOM. Return true to
   * handle it (the default insertion is then suppressed). Used by
   * track changes to wrap typed text in an insertion mark.
   */
  handleTextInput?: (editor: EditorInstance, text: string) => boolean;
  /**
   * Intercept a delete (Backspace / Delete) before it reaches the
   * DOM. Return true to handle it. Used by track changes to mark text
   * for deletion instead of removing it.
   */
  handleDeleteContent?: (
    editor: EditorInstance,
    direction: "backward" | "forward",
  ) => boolean;
  /** Lifecycle hooks. */
  onCreate?: (editor: EditorInstance) => void;
  onDestroy?: (editor: EditorInstance) => void;
  /** Returns a configured copy. */
  configure?: (options: Record<string, unknown>) => Extension;
}

export interface InputRule {
  /** Regex matched against text just before the cursor. */
  match: RegExp;
  /** Run when the rule matches; returns a Command. */
  handler: (
    editor: EditorInstance,
    match: RegExpExecArray,
  ) => boolean;
}

/** Editor configuration passed to `createEditor`. */
export interface EditorOptions {
  /** Initial content. HTML string or DocumentJSON. */
  content?: string | DocumentJSON;
  /** Extensions to load. May be a flat list of extensions or an array of
   *  extension bundles (StarterKit is a bundle that exposes `.extensions`). */
  extensions?: (Extension | ExtensionBundle)[];
  /** Element that hosts the contenteditable surface. If omitted, the
   *  editor runs in "headless" mode (no DOM mount). */
  element?: HTMLElement;
  /** Editable flag. */
  editable?: boolean;
  /** Placeholder text (the placeholder extension consumes this). */
  placeholder?: string;
  /** Auto-focus on mount. */
  autofocus?: boolean;
  /**
   * Opt in to deep selection paths. When false (default),
   * `SelectionPoint.path` is a single top-level block index — the
   * established behaviour every command relies on. When true,
   * `pointFromDOM` emits a full path down to the leaf block (into
   * table cells, list items), and `domNodeFromPoint` accepts one.
   * Flipped on per subsystem as commands migrate to the path helpers.
   */
  deepSelection?: boolean;
  /** Event callbacks. */
  onCreate?: (ctx: { editor: EditorInstance }) => void;
  onUpdate?: (ctx: {
    editor: EditorInstance;
    html: string;
    json: DocumentJSON;
  }) => void;
  onFocus?: (ctx: { editor: EditorInstance }) => void;
  onBlur?: (ctx: { editor: EditorInstance }) => void;
  onSelectionUpdate?: (ctx: {
    editor: EditorInstance;
    selection: EditorSelection | null;
  }) => void;
  onTransaction?: (ctx: { editor: EditorInstance }) => void;
  onDestroy?: (ctx: { editor: EditorInstance }) => void;
}

/** A bundle exposes `extensions: Extension[]` (e.g. StarterKit). */
export interface ExtensionBundle {
  name: string;
  extensions: Extension[];
}

/** Forward declaration; concrete shape lives in editor.ts. */
export interface EditorInstance {
  readonly options: EditorOptions;
  readonly element: HTMLElement | null;
  readonly extensions: Extension[];
  readonly schema: CompiledSchema;
  readonly commands: Record<string, (...args: any[]) => boolean>;

  /** Current document (immutable from the outside). */
  getJSON(): DocumentJSON;
  getHTML(): string;

  /** Replace document content. */
  setContent(content: string | DocumentJSON): void;

  /** Selection helpers. */
  getSelection(): EditorSelection | null;
  setSelection(selection: EditorSelection): void;
  /** Pixel coordinates of a selection point, for positioning overlays. */
  coordsAtPoint(
    point: SelectionPoint,
  ): { top: number; left: number; height: number } | null;

  /** Lifecycle. */
  focus(): void;
  blur(): void;
  destroy(): void;

  /** Current editability state. */
  isEditable(): boolean;

  /** History state queries used by toolbar disabled states. */
  canUndo(): boolean;
  canRedo(): boolean;

  /**
   * Attach the editor to a DOM element. Use this when the element
   * is not known at construction time (e.g. inside a React effect).
   * Calling twice on the same editor is a no-op the second time.
   */
  mount(element: HTMLElement): void;

  /** Mark / node state queries. */
  isActive(name: string, attrs?: Record<string, unknown>): boolean;

  /** Event subscription. */
  on<E extends EditorEventName>(
    event: E,
    handler: (payload: EditorEventPayload[E]) => void,
  ): () => void;

  /** Run a transaction. Internal but exposed for advanced extensions. */
  dispatch(tr: Transaction): void;
}

/** A compiled schema groups node/mark specs by name for fast lookup. */
export interface CompiledSchema {
  nodes: Record<string, NodeSpec>;
  marks: Record<string, MarkSpec>;
}

/** Transactions describe a change to the document + selection. */
export interface Transaction {
  /** New document state, if changed. */
  doc?: DocumentJSON;
  /** New selection, if changed. */
  selection?: EditorSelection | null;
  /** Whether this transaction should be added to history. */
  addToHistory?: boolean;
  /** Optional metadata bag (for plugins to tag transactions). */
  meta?: Record<string, unknown>;
}

/** Editor event payloads. */
export interface EditorEventPayload {
  create: { editor: EditorInstance };
  update: { editor: EditorInstance; html: string; json: DocumentJSON };
  focus: { editor: EditorInstance };
  blur: { editor: EditorInstance };
  selectionUpdate: {
    editor: EditorInstance;
    selection: EditorSelection | null;
  };
  transaction: { editor: EditorInstance; transaction: Transaction };
  destroy: { editor: EditorInstance };
}

export type EditorEventName = keyof EditorEventPayload;
