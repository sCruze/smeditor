import { useEffect, useId, useMemo, useState } from "react";
import {
  useEditor,
  EditorProvider,
  EditorContent,
  Toolbar,
  ToolbarDivider,
  // Marks
  BoldButton,
  ItalicButton,
  UnderlineButton,
  StrikeButton,
  LinkButton,
  ClearFormattingButton,
  // Block actions
  BlockquoteButton,
  CodeBlockButton,
  HorizontalRuleButton,
  // Image
  ImageButton,
  ImageToolbar,
  // Table
  TableButton,
  TableToolbar,
  // Fonts
  FontFamilyDropdown,
  FontSizeDropdown,
  LineHeightDropdown,
  // Image resize
  ImageResizer,
  // Table column resize
  TableColumnResizer,
  TableCellSelection,
  // Floating menus
  BubbleMenu,
  SlashMenu,
  MentionMenu,
  TrackChangesPanel,
  type MentionItem,
  // Dropdowns
  BlockTypeDropdown,
  ListsDropdown,
  AlignDropdown,
  // Color pickers (FullKit only)
  TextColorButton,
  TextStrokeButton,
  BackgroundColorButton,
  HighlightButton,
  // More (FullKit only)
  MoreMenu,
  // History
  UndoButton,
  RedoButton,
  icons,
  // Source view (§11)
  SourceView,
} from "@smeditor/react";
import {
  StarterKit,
  ParagraphExtension,
  HeadingExtension,
  BoldExtension,
  ItalicExtension,
  LinkExtension,
  ImageExtension,
  HistoryExtension,
  PlaceholderExtension,
} from "@smeditor/starter-kit";
import { FullKit, countWords, countCharacters } from "@smeditor/full-kit";
import { toMarkdown, fromMarkdown } from "@smeditor/extension-markdown";
import {
  getCommentThreads,
  type CommentThreadRef,
} from "@smeditor/extension-comment";
import type { DocumentJSON, ExtensionBundle } from "@smeditor/core";

// ---------------------------------------------------------------------------
// Sample documents
// ---------------------------------------------------------------------------

const SAMPLE_HTML = `
<h1>SMEditor playground</h1>
<p>Rich text with <strong>bold</strong>, <em>italic</em>, <u>underline</u>,
<s>strike</s>, <code>inline code</code>, and
<a href="https://example.com">links</a>.</p>

<h2 style="text-align: center">Block types</h2>
<p style="text-align: right">Paragraph, headings (H1-H6), quote, code block,
and horizontal rule — pick from the block type dropdown.</p>

<hr>

<h3>Lists</h3>
<ul><li><p>Bullet one</p></li><li><p>Bullet two</p></li></ul>
<ol><li><p>Ordered one</p></li><li><p>Ordered two</p></li></ol>
<ul class="smeditor-task-list">
  <li class="smeditor-task-item" data-checked="true"><p>A checked task</p></li>
  <li class="smeditor-task-item" data-checked="false"><p>An unchecked task</p></li>
</ul>

<blockquote><p>Block quotes wrap a section in a softer voice.</p></blockquote>
<pre><code>console.log("code block");</code></pre>

<h3>Markdown shortcuts</h3>
<p>Type at the start of an empty line: <code># </code> for a heading,
<code>&gt; </code> for a quote, <code>- </code> for a bullet,
<code>1. </code> for a numbered list, three backticks for a code
block, <code>--- </code> for a divider.</p>

<h3>Slash &amp; bubble menus</h3>
<p>Type <code>/</code> on an empty line to open the block-insert menu —
use the arrow keys and Enter. Select any text to get the bubble
formatting menu above it. Type <code>@</code> to mention someone.</p>

<h3>Tables</h3>
<table class="smeditor-table">
  <tr><th colspan="2"><p>SMEditor feature matrix</p></th></tr>
  <tr><th><p>Feature</p></th><th><p>Edition</p></th></tr>
  <tr><td><p>Tables</p></td><td><p>Standard + Full</p></td></tr>
  <tr><td><p>Markdown shortcuts</p></td><td><p>Standard</p></td></tr>
</table>
<p>Click inside the table — a context toolbar appears for adding and
removing rows and columns, toggling headers, setting cell background,
and changing cell alignment.</p>

<figure class="smeditor-figure" data-align="center"><img class="smeditor-image" src="https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600" alt="A small dog" /><figcaption class="smeditor-figcaption">A captioned image — select it and use the Caption button.</figcaption></figure>

<p>FullKit also adds <mark style="background-color: #fef08a">highlighter</mark>,
<span style="color: #ef4444">text color</span>,
<span style="background-color: #ddd6fe">background color</span>,
H<sub>2</sub>O, E = mc<sup>2</sup>, and Tab-driven indent.</p>
`;


const SCENARIO_HTML = {
  richText: `
<h1>Rich text scenario</h1>
<p><strong>Bold</strong>, <em>italic</em>, <u>underline</u>, <s>strike</s>, <code>inline code</code>, and <a href="https://example.com">a safe link</a>.</p>
<p style="text-align: center">Centered paragraph with mixed inline formatting.</p>
`,
  table: `
<h1>Table scenario</h1>
<table class="smeditor-table">
  <tr><th style="background-color: #f3f4f6; text-align: center"><p>Feature</p></th><th style="background-color: #f3f4f6; text-align: center"><p>Status</p></th></tr>
  <tr><td><p>Insert table</p></td><td style="text-align: right"><p>Working</p></td></tr>
  <tr><td style="background-color: #fef3c7"><p>Cell background</p></td><td><p>Persisted</p></td></tr>
</table>
`,
  blockquote: `
<h1>Blockquote scenario</h1>
<blockquote>
  <h2 style="text-align: center">Nested heading</h2>
  <p><strong>Quote text</strong> with preserved marks.</p>
  <ul><li><p>Nested list item</p></li><li><p>Second nested item</p></li></ul>
</blockquote>
`,
  colors: `
<h1>Colors scenario</h1>
<p><span style="color: #ef4444">Text color</span>, <span style="background-color: #ddd6fe">background color</span>, <mark style="background-color: #fef08a">highlight</mark>, and <span style="-webkit-text-stroke: 1px #111827; text-stroke: 1px #111827">text stroke</span>.</p>
`,
  image: `
<h1>Image scenario</h1>
<figure class="smeditor-figure" data-align="center"><img class="smeditor-image" src="https://images.unsplash.com/photo-1517849845537-4d257902454a?w=600" alt="A small dog" title="Demo image" width="420" height="280" /></figure>
<p>Use URL insert, paste, or drag and drop image files to test upload behavior.</p>
`,
  lists: `
<h1>Lists scenario</h1>
<ul><li><p>Bullet item</p></li><li><p>Second bullet item</p></li></ul>
<ol><li><p>Ordered item</p></li><li><p>Second ordered item</p></li></ol>
<ul class="smeditor-task-list"><li class="smeditor-task-item" data-checked="true"><p>Checked task</p></li><li class="smeditor-task-item" data-checked="false"><p>Unchecked task</p></li></ul>
`,
  code: `
<h1>Code scenario</h1>
<p>Inline <code>code</code> next to a code block.</p>
<pre><code>const message = "SMEditor";
console.log(message);</code></pre>
`,
} as const;

type ScenarioName = keyof typeof SCENARIO_HTML;

const SCENARIOS: Array<{ name: ScenarioName; label: string }> = [
  { name: "richText", label: "Rich text" },
  { name: "table", label: "Table" },
  { name: "blockquote", label: "Blockquote" },
  { name: "colors", label: "Colors" },
  { name: "image", label: "Image" },
  { name: "lists", label: "Lists" },
  { name: "code", label: "Code" },
];

// `configure` is optional on the Extension type but always present on
// ImageExtension; assert it so the example type-checks under strict mode.
const PlaygroundImageExtension = ImageExtension.configure!({
  upload: demoUpload,
});

const PLAYGROUND_STARTER_KIT: ExtensionBundle = {
  name: "playground-starter-kit",
  extensions: StarterKit.extensions.map((extension) =>
    extension === ImageExtension ? PlaygroundImageExtension : extension,
  ),
};

const PLAYGROUND_FULL_KIT: ExtensionBundle = {
  name: "playground-full-kit",
  extensions: FullKit.extensions.map((extension) =>
    extension === ImageExtension ? PlaygroundImageExtension : extension,
  ),
};

const PLAYGROUND_CUSTOM_KIT: ExtensionBundle = {
  name: "playground-custom-kit",
  extensions: [
    ParagraphExtension,
    HeadingExtension,
    BoldExtension,
    ItalicExtension,
    LinkExtension,
    PlaceholderExtension,
    HistoryExtension,
  ],
};

const EXPECTED_COMMANDS = [
  "setContent",
  "clearContent",
  "setParagraph",
  "toggleBold",
  "toggleItalic",
  "toggleUnderline",
  "toggleStrike",
  "setLink",
  "toggleBlockquote",
  "toggleCodeBlock",
  "toggleBulletList",
  "toggleOrderedList",
  "toggleTaskList",
  "insertImage",
  "uploadImage",
  "insertTable",
  "addRowAfter",
  "addColumnAfter",
  "deleteTable",
  "setTextAlign",
  "setTextColor",
  "setBackgroundColor",
  "toggleHighlight",
  "setTextStroke",
  "setFontFamily",
  "setFontSize",
  "setLineHeight",
  "clearFormatting",
  "undo",
  "redo",
];

// ---------------------------------------------------------------------------
// View / theme / edition toggles
// ---------------------------------------------------------------------------

type ViewMode = "edit" | "writer" | "just-editor" | "source";
type Edition = "standard" | "full" | "custom";
type Theme = "light" | "dark";

function ModePill<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; title?: string }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      className="playground__mode-toggle"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          title={opt.title ?? opt.label}
          aria-selected={value === opt.value}
          data-active={value === opt.value ? "true" : "false"}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment threads — the host owns thread content; the editor only marks text.
// ---------------------------------------------------------------------------

interface CommentMessage {
  author: string;
  body: string;
  at: number;
}
interface CommentThread {
  id: string;
  messages: CommentMessage[];
}

let threadCounter = 0;
const newThreadId = () => `thread-${Date.now()}-${threadCounter++}`;

/** Demo mention candidates — a real app would fetch these. */
const MENTION_PEOPLE: MentionItem[] = [
  { id: "u-ada", label: "Ada Lovelace", hint: "Engineering" },
  { id: "u-grace", label: "Grace Hopper", hint: "Compilers" },
  { id: "u-alan", label: "Alan Turing", hint: "Research" },
  { id: "u-edsger", label: "Edsger Dijkstra", hint: "Algorithms" },
  { id: "u-barbara", label: "Barbara Liskov", hint: "Systems" },
  { id: "u-donald", label: "Donald Knuth", hint: "Typesetting" },
];

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

export function App() {
  const [html, setHtml] = useState("");
  const [json, setJson] = useState<DocumentJSON | null>(null);
  const [htmlInput, setHtmlInput] = useState(SAMPLE_HTML.trim());
  const [activeScenario, setActiveScenario] = useState<
    ScenarioName | "sample" | "custom"
  >("sample");
  const [playgroundError, setPlaygroundError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>("edit");
  const [edition, setEdition] = useState<Edition>("full");
  const [theme, setTheme] = useState<Theme>(getInitialTheme());
  const [editable, setEditable] = useState(true);

  // The thread store, keyed by threadId. A real app would persist this.
  const [threads, setThreads] = useState<Record<string, CommentThread>>({});

  // Apply the chosen theme to <html>. The default theme reads
  // `[data-theme]` and switches its CSS variables accordingly.
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("gv-playground-theme", theme);
    } catch {
      /* localStorage may be disabled — silently ignore */
    }
  }, [theme]);

  const extensions = useMemo(() => {
    if (edition === "full") return [PLAYGROUND_FULL_KIT];
    if (edition === "custom") return [PLAYGROUND_CUSTOM_KIT];
    return [PLAYGROUND_STARTER_KIT];
  }, [edition]);

  const { editor, version } = useEditor({
    extensions,
    content: SAMPLE_HTML,
    placeholder: "Start typing…",
    // Deep selection: paths reach into table cells / list items, so
    // formatting commands target the exact leaf block.
    deepSelection: true,
    onUpdate: ({ html, json }) => {
      setHtml(html);
      setJson(json);
    },
    onCreate: ({ editor }) => {
      setHtml(editor.getHTML());
      setJson(editor.getJSON());
    },
  });

  const availableCommandNames = useMemo(() => {
    void version;
    return Object.keys(editor?.commands ?? {}).sort();
  }, [editor, version]);

  const missingCommandNames = useMemo(
    () =>
      EXPECTED_COMMANDS.filter(
        (name) => !availableCommandNames.includes(name),
      ),
    [availableCommandNames],
  );

  const applyHTMLToEditor = (
    nextHTML: string,
    scenario: ScenarioName | "sample" | "custom",
  ) => {
    if (!editor) {
      setPlaygroundError("Editor is not ready yet.");
    } else {
      editor.commands.setContent(nextHTML);
      setHtmlInput(nextHTML.trim());
      setActiveScenario(scenario);
      setPlaygroundError(null);
    }
  };

  const applyHTMLInput = () => {
    if (htmlInput.trim().length === 0) {
      setPlaygroundError("HTML input is empty.");
    } else {
      applyHTMLToEditor(htmlInput, "custom");
    }
  };

  const resetSample = () => applyHTMLToEditor(SAMPLE_HTML, "sample");

  // Toggle task-item checked state on clicks in the checkbox gutter.
  useEffect(() => {
    if (!editor) return;
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      const item = el.closest(".smeditor-task-item");
      if (!item) return;
      const rect = item.getBoundingClientRect();
      if (e.clientX - rect.left > 22) return;
      e.preventDefault();
      const listEl = item.parentElement;
      if (!listEl) return;
      const listIdx = Array.from(editor.element?.children ?? []).indexOf(listEl);
      const idx = Array.from(listEl.children).indexOf(item);
      if (listIdx < 0 || idx < 0) return;
      editor.setSelection({
        anchor: { path: [listIdx, idx], offset: 0 },
        head: { path: [listIdx, idx], offset: 0 },
      });
      editor.commands.toggleTaskChecked?.();
    };
    const host = editor.element;
    host?.addEventListener("click", onClick);
    return () => host?.removeEventListener("click", onClick);
  }, [editor]);

  // Word/character counts — Full only.
  const counts = useMemo(() => {
    if (!json || edition !== "full") return null;
    return { words: countWords(json), chars: countCharacters(json) };
  }, [json, edition]);

  return (
    <div className={`playground playground--${viewMode}`}>
      {/* ===== Top chrome — hidden in just-editor mode ===== */}
      {viewMode !== "just-editor" && (
        <header className="playground__header">
          <h1>SMEditor</h1>
          <span className="playground__tag">playground · dev build</span>
          <div className="playground__spacer" />

          <ModePill<Edition>
            value={edition}
            options={[
              { value: "standard", label: "StarterKit" },
              { value: "full", label: "FullKit" },
              { value: "custom", label: "Custom" },
            ]}
            onChange={setEdition}
            ariaLabel="Extension mode"
          />

          <ModePill<ViewMode>
            value={viewMode}
            options={[
              { value: "edit", label: "Edit + inspect" },
              { value: "writer", label: "Writer" },
              { value: "just-editor", label: "Just editor" },
              { value: "source", label: "Source" },
            ]}
            onChange={setViewMode}
            ariaLabel="View mode"
          />

          <button
            type="button"
            className="smeditor-button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={
              theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
            }
            title={theme === "dark" ? "Light theme" : "Dark theme"}
          >
            {theme === "dark" ? <icons.IconSun /> : <icons.IconMoon />}
          </button>

          <button
            type="button"
            className="smeditor-button"
            onClick={() => setEditable((v) => !v)}
            aria-pressed={!editable}
            aria-label={
              editable
                ? "Switch editor to read-only mode"
                : "Switch editor to edit mode"
            }
            title={editable ? "Read-only" : "Editable"}
          >
            {editable ? "View" : "Edit"}
          </button>

          <button
            type="button"
            className="smeditor-button"
            onClick={resetSample}
            aria-label="Reset playground sample content"
            title="Reset the playground sample content"
          >
            Reset
          </button>

          <button
            type="button"
            className="smeditor-button"
            onClick={() => {
              if (!editor) return;
              const md = window.prompt("Paste Markdown to import");
              if (md == null) return;
              editor.dispatch({
                doc: fromMarkdown(md),
                selection: {
                  anchor: { path: [0], offset: 0 },
                  head: { path: [0], offset: 0 },
                },
                addToHistory: true,
              });
              setActiveScenario("sample");
              setPlaygroundError(null);
            }}
            aria-label="Import Markdown into the editor"
            title="Replace the document with imported Markdown"
          >
            Import MD
          </button>
        </header>
      )}

      {/* When in just-editor mode, a tiny floating control to escape. */}
      {viewMode === "just-editor" && (
        <button
          type="button"
          className="playground__exit-pristine"
          onClick={() => setViewMode("edit")}
          aria-label="Show playground controls"
          title="Show controls"
        >
          ⌘
        </button>
      )}

      <main className="playground__grid">
        <section className="playground__editor" aria-label="Editor workspace">
          <EditorProvider editor={editor}>
            {viewMode === "source" ? (
              <div className="smeditor">
                <SourceView />
              </div>
            ) : (
              <>
            <div className="smeditor">
              <Toolbar ariaLabel="Playground editor toolbar">
                <UndoButton />
                <RedoButton />
                <ToolbarDivider />

                <BlockTypeDropdown />
                <ListsDropdown />
                <ToolbarDivider />

                <BoldButton />
                <ItalicButton />
                <StrikeButton />
                <UnderlineButton />
                <ClearFormattingButton />
                <LinkButton />
                <ToolbarDivider />

                <AlignDropdown />
                <ToolbarDivider />

                <BlockquoteButton />
                <CodeBlockButton />
                <HorizontalRuleButton />
                <ImageButton onUpload={demoUpload} />
                <TableButton />

                {/* Full-edition-only tools */}
                {edition === "full" && (
                  <>
                    <ToolbarDivider />
                    <HighlightButton />
                    <TextColorButton />
                    <TextStrokeButton />
                    <BackgroundColorButton />
                    <FontFamilyDropdown />
                    <FontSizeDropdown />
                    <LineHeightDropdown />
                    <ToolbarDivider />
                    <button
                      type="button"
                      className="smeditor-button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        if (!editor) return;
                        const body = window.prompt("New comment");
                        if (!body) return;
                        const id = newThreadId();
                        if (editor.commands.addComment?.({ threadId: id })) {
                          setThreads((prev) => ({
                            ...prev,
                            [id]: {
                              id,
                              messages: [
                                { author: "You", body, at: Date.now() },
                              ],
                            },
                          }));
                        }
                      }}
                      aria-label="Comment on the selected text"
                      title="Comment on the selected text"
                    >
                      Comment
                    </button>
                    <MoreMenu />
                  </>
                )}
              </Toolbar>
              <EditorContent
                editor={editor}
                editable={editable}
                ariaLabel="Playground rich text editor"
              />
              {/* Contextual toolbars — render only when relevant */}
              <ImageToolbar />
              <TableToolbar />
              {/* Drag-handle overlays */}
              <ImageResizer />
              <TableColumnResizer />
              <TableCellSelection />
            </div>
            {/* Floating menus — render once per editor, anywhere inside
                the provider. They position themselves against the
                selection / caret. */}
            <BubbleMenu />
            <SlashMenu />
            <MentionMenu items={MENTION_PEOPLE} />
            </>
            )}
          </EditorProvider>

          {/* Footer line — counts in Full edition */}
          {viewMode !== "just-editor" && counts && (
            <div className="playground__counts">
              <span>{counts.words} words</span>
              <span aria-hidden="true">·</span>
              <span>{counts.chars} characters</span>
            </div>
          )}
        </section>

        {viewMode === "edit" && (
          <section className="playground__inspector" aria-label="Editor inspector">
            <Inspector title="Scenarios">
              <div className="scenario-grid">
                <button
                  type="button"
                  className="smeditor-button"
                  data-active={activeScenario === "sample" ? "true" : "false"}
                  onClick={resetSample}
                >
                  Full sample
                </button>
                {SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.name}
                    type="button"
                    className="smeditor-button"
                    data-active={
                      activeScenario === scenario.name ? "true" : "false"
                    }
                    onClick={() =>
                      applyHTMLToEditor(
                        SCENARIO_HTML[scenario.name],
                        scenario.name,
                      )
                    }
                  >
                    {scenario.label}
                  </button>
                ))}
              </div>
            </Inspector>

            <Inspector title="HTML input">
              <div className="html-input">
                <textarea
                  value={htmlInput}
                  onChange={(event) => {
                    setHtmlInput(event.currentTarget.value);
                    setPlaygroundError(null);
                  }}
                  rows={10}
                  spellCheck={false}
                  aria-label="HTML input"
                />
                <div className="html-input__actions">
                  <button
                    type="button"
                    className="smeditor-button"
                    onClick={applyHTMLInput}
                  >
                    Load HTML
                  </button>
                  <button
                    type="button"
                    className="smeditor-button"
                    onClick={resetSample}
                  >
                    Reset sample
                  </button>
                </div>
              </div>
            </Inspector>

            {(playgroundError || missingCommandNames.length > 0) && (
              <Inspector title="Error panel">
                {playgroundError && (
                  <p className="playground-error">{playgroundError}</p>
                )}
                {missingCommandNames.length > 0 && (
                  <div className="command-diagnostics">
                    <p>
                      Missing commands in the active extension mode:
                    </p>
                    <code>{missingCommandNames.join(", ")}</code>
                  </div>
                )}
              </Inspector>
            )}

            <Inspector title="Available commands">
              <div className="command-list">
                {availableCommandNames.map((name) => (
                  <code key={name}>{name}</code>
                ))}
              </div>
            </Inspector>

            {edition === "full" && (
              <Inspector title="Comments">
                <CommentsPanel
                  doc={json}
                  threads={threads}
                  onReply={(id, body) =>
                    setThreads((prev) => {
                      const t = prev[id];
                      if (!t) return prev;
                      return {
                        ...prev,
                        [id]: {
                          ...t,
                          messages: [
                            ...t.messages,
                            { author: "You", body, at: Date.now() },
                          ],
                        },
                      };
                    })
                  }
                  onResolve={(id, resolved) => {
                    if (!editor) return;
                    if (resolved) editor.commands.reopenComment?.({ threadId: id });
                    else editor.commands.resolveComment?.({ threadId: id });
                  }}
                  onRemove={(id) => {
                    editor?.commands.removeComment?.({ threadId: id });
                    setThreads((prev) => {
                      const next = { ...prev };
                      delete next[id];
                      return next;
                    });
                  }}
                />
              </Inspector>
            )}
            {edition === "full" && (
              <Inspector title="Track changes">
                <TrackChangesPanel />
              </Inspector>
            )}
            <Inspector title="HTML">
              <pre>{html}</pre>
            </Inspector>
            <Inspector title="JSON">
              <pre>{json ? JSON.stringify(json, null, 2) : ""}</pre>
            </Inspector>
            <Inspector title="Markdown (export)">
              <pre>{json ? toMarkdown(json) : ""}</pre>
            </Inspector>
          </section>
        )}
      </main>
    </div>
  );
}

/**
 * Comments panel — lists the threads still referenced by the
 * document, joins them with the host's thread store, and offers
 * reply / resolve / remove.
 */
function CommentsPanel({
  doc,
  threads,
  onReply,
  onResolve,
  onRemove,
}: {
  doc: DocumentJSON | null;
  threads: Record<string, CommentThread>;
  onReply: (id: string, body: string) => void;
  onResolve: (id: string, resolved: boolean) => void;
  onRemove: (id: string) => void;
}) {
  const refs: CommentThreadRef[] = doc ? getCommentThreads(doc) : [];
  if (refs.length === 0) {
    return (
      <p className="comments__empty">
        Select text and press Comment to start a thread.
      </p>
    );
  }
  return (
    <div className="comments">
      {refs.map((ref) => {
        const thread = threads[ref.threadId];
        return (
          <div
            key={ref.threadId}
            className={
              "comments__thread" + (ref.resolved ? " is-resolved" : "")
            }
          >
            {thread ? (
              thread.messages.map((m, i) => (
                <div key={i} className="comments__message">
                  <span className="comments__author">{m.author}</span>
                  <span className="comments__body">{m.body}</span>
                </div>
              ))
            ) : (
              <div className="comments__message">
                <em>(thread not in store)</em>
              </div>
            )}
            <div className="comments__actions">
              <button
                type="button"
                className="smeditor-button"
                onClick={() => {
                  const body = window.prompt("Reply");
                  if (body) onReply(ref.threadId, body);
                }}
              >
                Reply
              </button>
              <button
                type="button"
                className="smeditor-button"
                onClick={() => onResolve(ref.threadId, ref.resolved)}
              >
                {ref.resolved ? "Reopen" : "Resolve"}
              </button>
              <button
                type="button"
                className="smeditor-button"
                onClick={() => onRemove(ref.threadId)}
              >
                Remove
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Inspector({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const titleId = useId();

  return (
    <section className="inspector" aria-labelledby={titleId}>
      <h2 id={titleId} className="inspector__title">
        {title}
      </h2>
      <div className="inspector__body">{children}</div>
    </section>
  );
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("gv-playground-theme");
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    /* ignore */
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Demo image upload — reads the file into a base64 data URL.
 *
 * A real app would POST the file to its backend / object storage and
 * resolve with the hosted URL. The playground has no backend, so a
 * data URL keeps the demo self-contained. Data URLs get large fast —
 * fine for a demo, not for production.
 */
function demoUpload(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
