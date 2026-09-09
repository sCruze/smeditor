/**
 * Documentation content. Each page is a React component; the App
 * shell renders the selected one beside a sidebar.
 *
 * The content is hand-written prose rather than MDX — it keeps the
 * docs site a plain Vite + React app with no extra toolchain.
 */

import type { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function Code({ children }: { children: ReactNode }) {
  return <code className="doc-code">{children}</code>;
}

function Pre({ children }: { children: string }) {
  return (
    <pre className="doc-pre">
      <code>{children}</code>
    </pre>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <div className="doc-note">{children}</div>;
}

function ApiTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="doc-table">
      <tbody>
        {rows.map(([name, desc]) => (
          <tr key={name}>
            <td>
              <Code>{name}</Code>
            </td>
            <td>{desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

function Introduction() {
  return (
    <article>
      <h1>SMEditor</h1>
      <p className="doc-lead">
        A rich-text editor library with a framework-agnostic core, React
        bindings, extension bundles, JSON/HTML serialization and a plain CSS
        theme.
      </p>
      <p>
        SMEditor is in pre-alpha. The repository is a monorepo of small npm
        packages: <Code>@smeditor/core</Code> owns the document and commands,
        <Code>@smeditor/react</Code> owns React lifecycle and toolbar UI, and
        feature packages contribute nodes, marks, commands and keyboard
        shortcuts.
      </p>
      <h2>Core principles</h2>
      <ul>
        <li>
          The document source of truth is JSON. HTML is an input/output format
          parsed and serialized through the active schema.
        </li>
        <li>
          The core only knows <Code>doc</Code> and <Code>text</Code> by default.
          Paragraphs, headings, lists, links, tables, images and colors all come
          from extensions.
        </li>
        <li>
          UI is outside core. Toolbars, dropdowns, source view and contextual UI
          live in <Code>@smeditor/react</Code>.
        </li>
        <li>
          Uploads are host-app responsibilities. The image extension calls a
          configured upload handler and inserts the returned safe URL.
        </li>
      </ul>
      <h2>Current package tiers</h2>
      <p>
        Use <Code>StarterKit</Code> for MVP editing features and <Code>FullKit</Code>
        for the richer MVP-safe formatting set. Advanced/Pro features are
        tracked as opt-in backlog work instead of default bundle requirements.
        Custom editors can pass a hand-picked extension list instead of a bundle.
      </p>
    </article>
  );
}

function Installation() {
  return (
    <article>
      <h1>Installation</h1>
      <p>
        React applications usually need the React binding, one extension bundle
        and the default CSS theme.
      </p>
      <Pre>{`npm install @smeditor/react @smeditor/starter-kit @smeditor/theme-default`}</Pre>
      <p>For the larger extension bundle:</p>
      <Pre>{`npm install @smeditor/react @smeditor/full-kit @smeditor/theme-default`}</Pre>
      <p>For headless usage without React:</p>
      <Pre>{`npm install @smeditor/core @smeditor/starter-kit`}</Pre>
      <h2>Workspace commands</h2>
      <ApiTable
        rows={[
          ["pnpm install", "Install the monorepo dependencies."],
          ["pnpm build", "Build all packages that expose a build script."],
          ["pnpm typecheck", "Run TypeScript checks across the workspace."],
          ["pnpm test", "Run package unit/regression tests."],
          ["pnpm test:e2e", "Run the playground Playwright smoke tests."],
          ["pnpm playground", "Start the playground at the configured Vite port."],
          ["pnpm docs", "Start the documentation site."],
        ]}
      />
    </article>
  );
}

function QuickStart() {
  return (
    <article>
      <h1>Quick start</h1>
      <h2>Drop-in React editor</h2>
      <Pre>{`import { Editor } from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";
import "@smeditor/theme-default";

export function MyEditor() {
  return (
    <Editor
      extensions={[StarterKit]}
      content="<p>Hello, SMEditor.</p>"
      onUpdate={({ html, json }) => {
        console.log(html, json);
      }}
    />
  );
}`}</Pre>
      <h2>Composable layout with toolbar</h2>
      <Pre>{`import {
  useEditor,
  EditorProvider,
  EditorContent,
  Toolbar,
  BoldButton,
  ItalicButton,
  HeadingButton,
} from "@smeditor/react";
import { StarterKit } from "@smeditor/starter-kit";

export function MyEditor() {
  const { editor, version } = useEditor({
    extensions: [StarterKit],
    content: "<p>Hello</p>",
  });

  return (
    <EditorProvider editor={editor} version={version}>
      <Toolbar>
        <BoldButton />
        <ItalicButton />
        <HeadingButton level={2} />
      </Toolbar>
      <EditorContent editor={editor} ariaLabel="Article body" />
    </EditorProvider>
  );
}`}</Pre>
      <h2>Headless core</h2>
      <Pre>{`import { createEditor } from "@smeditor/core";
import { StarterKit } from "@smeditor/starter-kit";

const editor = createEditor({
  extensions: [StarterKit],
  content: "<p>Hello</p>",
});

editor.commands.toggleBold?.();
console.log(editor.getHTML());
console.log(editor.getJSON());`}</Pre>
    </article>
  );
}

function CoreConcepts() {
  return (
    <article>
      <h1>Core concepts</h1>
      <h2>Document model</h2>
      <p>
        A document is always <Code>{"{ type: 'doc', content: [...] }"}</Code>.
        Block and inline nodes share the <Code>DocumentNode</Code> shape:
        <Code>type</Code>, optional <Code>text</Code>, optional <Code>marks</Code>,
        optional <Code>attrs</Code> and optional child <Code>content</Code>.
      </p>
      <Pre>{`{
  "type": "doc",
  "content": [
    {
      "type": "paragraph",
      "content": [
        { "type": "text", "text": "Hello", "marks": [{ "type": "bold" }] }
      ]
    }
  ]
}`}</Pre>
      <h2>Selection</h2>
      <p>
        A selection is two points: <Code>anchor</Code> and <Code>head</Code>.
        Each point has a zero-based <Code>path</Code> and a visible-text
        <Code>offset</Code>. Deep selection paths allow commands to target text
        inside blockquotes, list items and table cells.
      </p>
      <h2>Transactions</h2>
      <p>
        Commands update the editor through <Code>editor.dispatch</Code>. A
        transaction may replace the document, update the selection, opt out of
        history, and carry metadata for extensions.
      </p>
      <h2>Events</h2>
      <ApiTable
        rows={[
          ["create", "Fired after the editor is constructed."],
          ["update", "Fired after document changes; includes html and json."],
          ["focus / blur", "Fired from the mounted contenteditable surface."],
          ["selectionUpdate", "Fired only when selection structure changed."],
          ["transaction", "Fired for every dispatch call."],
          ["destroy", "Fired when the editor is destroyed."],
        ]}
      />
    </article>
  );
}

function ReactUsage() {
  return (
    <article>
      <h1>React usage</h1>
      <h2>useEditor</h2>
      <p>
        <Code>useEditor</Code> returns <Code>{"{ editor, version }"}</Code>.
        The <Code>editor</Code> field is the core instance. The <Code>version</Code>
        field increments on editor lifecycle, update and selection changes so UI
        can re-read active/disabled state.
      </p>
      <h2>EditorContent</h2>
      <p>
        <Code>EditorContent</Code> mounts the editor to a contenteditable div,
        wires image paste/drop upload support, and exposes accessibility props
        such as <Code>ariaLabel</Code> and <Code>editable</Code>.
      </p>
      <h2>EditorProvider</h2>
      <p>
        Toolbar components read the editor from context. The provider also
        subscribes to update, selection and destroy events so toolbar state stays
        reactive even when the layout is composed manually.
      </p>
      <h2>Drop-in Editor</h2>
      <p>
        <Code>Editor</Code> combines <Code>useEditor</Code>,
        <Code>EditorProvider</Code> and <Code>EditorContent</Code>. It is the
        shortest path for simple forms.
      </p>
    </article>
  );
}

function ExtensionsAndCommands() {
  return (
    <article>
      <h1>Extensions, commands and schema</h1>
      <p>
        Extensions are plain objects. They can contribute nodes, marks, commands,
        keyboard shortcuts, input rules, paste transforms and lifecycle hooks.
      </p>
      <Pre>{`import type { Extension } from "@smeditor/core";

export const EmphasisExtension: Extension = {
  name: "emphasis",
  marks: [
    {
      name: "emphasis",
      toDOM: () => ["em", 0],
      parseDOM: [{ tag: "em" }],
    },
  ],
  commands: {
    toggleEmphasis: () => (editor) => {
      editor.commands.toggleMark?.("emphasis");
      return true;
    },
  },
};`}</Pre>
      <h2>Command shape</h2>
      <p>
        An extension command is a function returning a command thunk. Once
        registered, it is available as <Code>editor.commands.commandName(...args)</Code>
        and returns <Code>true</Code> when it applied.
      </p>
      <h2>Common command names</h2>
      <ApiTable
        rows={[
          ["setContent(htmlOrJSON)", "Core command for replacing content when available through editor API."],
          ["toggleBold / toggleItalic / toggleUnderline / toggleStrike", "Inline mark toggles."],
          ["setHeading({ level }) / setParagraph", "Block type commands."],
          ["toggleBulletList / toggleOrderedList / toggleTaskList", "List wrappers."],
          ["toggleBlockquote / setCodeBlock", "Blockquote and code block commands."],
          ["setLink / unsetLink", "Link mark commands from the link extension."],
          ["setTextAlign / indent / outdent", "Layout commands."],
          ["setTextColor / setBackgroundColor / setHighlight / setTextStroke", "Color and stroke marks."],
          ["insertImage / uploadImage / setImageAlign", "Image commands."],
          ["insertTable / addRowAfter / deleteColumn / setCellBackground", "Table commands."],
          ["undo / redo", "History commands and toolbar actions."],
        ]}
      />
    </article>
  );
}

function Bundles() {
  return (
    <article>
      <h1>StarterKit and FullKit</h1>
      <h2>StarterKit</h2>
      <p>
        <Code>@smeditor/starter-kit</Code> includes the MVP editor set:
        paragraph, heading, blockquote, code block, hard break, horizontal rule,
        image, table, lists, task lists, bold, italic, underline, strike, link,
        text align, clear formatting, markdown shortcuts, placeholder and
        history.
      </p>
      <h2>FullKit</h2>
      <p>
        <Code>@smeditor/full-kit</Code> reuses StarterKit and adds richer inline
        formatting and editor services: inline code, subscript, superscript,
        highlight, text color, background color, text stroke, font family, font
        size, line height, indent and word count. Comments, mentions, track
        changes and collaboration are advanced opt-in packages, not default
        FullKit behaviour.
      </p>
      <h2>Custom bundle</h2>
      <Pre>{`import { ParagraphExtension, BoldExtension } from "@smeditor/starter-kit";

const MinimalKit = {
  name: "minimal-kit",
  extensions: [ParagraphExtension, BoldExtension],
};`}</Pre>
    </article>
  );
}

function Toolbar() {
  return (
    <article>
      <h1>Toolbar</h1>
      <p>
        Toolbar components are command bindings. They hide or disable themselves
        according to command availability, read-only state and active selection
        state.
      </p>
      <h2>Available toolbar pieces</h2>
      <ApiTable
        rows={[
          ["Toolbar / ToolbarDivider", "Container and visual separators."],
          ["BoldButton, ItalicButton, UnderlineButton, StrikeButton", "Inline marks."],
          ["ParagraphButton, HeadingButton, BlockquoteButton, CodeBlockButton", "Block type actions."],
          ["BulletListButton, OrderedListButton, TaskListButton", "List actions."],
          ["AlignDropdown, IndentButton, OutdentButton", "Layout controls."],
          ["TextColorButton, BackgroundColorButton, HighlightButton, TextStrokeButton", "Color controls."],
          ["FontFamilyDropdown, FontSizeDropdown, LineHeightDropdown", "Typography controls."],
          ["ImageButton, ImageToolbar", "Image URL/upload and image alignment."],
          ["TableButton, TableToolbar", "Table insertion and row/column/cell commands."],
          ["UndoButton, RedoButton, ClearFormattingButton", "History and cleanup actions."],
        ]}
      />
      <Note>
        Toolbar state depends on the extensions passed to the editor. A button
        whose command does not exist will not offer a working no-op action.
      </Note>
    </article>
  );
}

function HtmlJson() {
  return (
    <article>
      <h1>HTML and JSON output</h1>
      <p>
        SMEditor accepts either HTML or <Code>DocumentJSON</Code> as content.
        On update, React callbacks receive both serialized HTML and cloned JSON.
      </p>
      <Pre>{`<Editor
  extensions={[StarterKit]}
  content="<p><strong>Hello</strong></p>"
  onUpdate={({ html, json }) => {
    save({ html, json });
  }}
/>`}</Pre>
      <h2>Round-trip behaviour</h2>
      <p>
        The parser and serializer are schema-driven. Marks such as bold, italic,
        link, color, background, highlight, font size, font family and text
        stroke are preserved when the corresponding extensions are active.
        Nested blockquotes, lists, tables and code blocks are parsed through
        their active node specs.
      </p>
      <h2>Sanitization boundary</h2>
      <p>
        Unsafe tags and unsafe URL protocols are not retained as executable
        content. Feature-specific sanitizers keep color tokens, links and image
        sources within the allowed formats for their extension.
      </p>
    </article>
  );
}

function TablesImagesColors() {
  return (
    <article>
      <h1>Tables, images, colors and marks</h1>
      <h2>Tables</h2>
      <p>
        The table extension supports MVP table creation, row/column insertion and
        deletion, deleting the whole table, header row/column toggles, cell
        background and cell alignment. Merge/split cells and spreadsheet-style
        editing are not part of the current MVP.
      </p>
      <Pre>{`editor.commands.insertTable?.({ rows: 3, cols: 3, headerRow: true });
editor.commands.addRowAfter?.();
editor.commands.setCellBackground?.({ color: "#fff7cc" });
editor.commands.setCellAlign?.({ align: "center" });`}</Pre>
      <h2>Images</h2>
      <p>
        Images are block nodes with <Code>src</Code>, <Code>alt</Code>,
        <Code>title</Code>, <Code>width</Code>, <Code>height</Code>,
        <Code>align</Code> and optional caption attrs. Uploads are configured on
        the image extension.
      </p>
      <Pre>{`import { ImageExtension } from "@smeditor/extension-image";

const image = ImageExtension.configure({
  upload: async (file) => {
    const url = await uploadToYourStorage(file);
    return { src: url, alt: file.name };
  },
});`}</Pre>
      <h2>Colors and marks</h2>
      <p>
        Text color, background color, highlight and text stroke are separate
        marks. The same CSS color sanitizer is used across the four extensions
        so commands, parsing and serialization agree on accepted color values.
      </p>
    </article>
  );
}

function ApiReference() {
  return (
    <article>
      <h1>API reference</h1>
      <h2>@smeditor/core</h2>
      <ApiTable
        rows={[
          ["createEditor(options)", "Create a headless or mounted editor instance."],
          ["compileSchema(extensions)", "Compile extension node/mark specs into lookup maps."],
          ["flattenExtensions(extensions)", "Flatten bundles such as StarterKit into extensions."],
          ["parseHTML(html, schema)", "Parse HTML into DocumentJSON using parseDOM rules."],
          ["serializeToHTML(doc, schema)", "Serialize DocumentJSON to HTML using toDOM rules."],
          ["sanitizeCSSColor(value)", "Accept safe CSS color tokens used by color extensions."],
        ]}
      />
      <h2>EditorInstance</h2>
      <ApiTable
        rows={[
          ["getJSON() / getHTML()", "Read the current document as cloned JSON or serialized HTML."],
          ["setContent(content)", "Replace content from HTML or DocumentJSON."],
          ["getSelection() / setSelection(selection)", "Read or write editor selection."],
          ["coordsAtPoint(point)", "Resolve selection coordinates for overlays when mounted."],
          ["focus() / blur() / destroy() / mount(element)", "Lifecycle and mounting methods."],
          ["isEditable()", "Read editability state."],
          ["canUndo() / canRedo()", "History availability queries."],
          ["isActive(name, attrs?)", "Check active node/mark state for toolbar UI."],
          ["on(event, handler)", "Subscribe to editor lifecycle/update events."],
          ["dispatch(transaction)", "Apply a transaction; intended mainly for extensions."],
        ]}
      />
      <h2>@smeditor/react</h2>
      <ApiTable
        rows={[
          ["useEditor(options)", "Create and manage an EditorInstance in React."],
          ["Editor", "Drop-in component with optional toolbar render prop."],
          ["EditorContent", "Contenteditable surface for composed layouts."],
          ["EditorProvider / useEditorContext", "Context bridge for toolbar and custom controls."],
          ["Toolbar and buttons", "Ready-made command bindings and dropdowns."],
          ["BubbleMenu, SlashMenu, MentionMenu", "Floating UI primitives for richer surfaces."],
          ["SourceView", "HTML/JSON source inspector/editor component."],
        ]}
      />
    </article>
  );
}

function RailsIntegration() {
  return (
    <article>
      <h1>Rails integration</h1>
      <p>
        Rails support lives in <Code>gems/smeditor</Code>. The adapter is
        separate from core and React: Rails helpers render integration points,
        sanitize/render stored content and expose upload routes where configured.
      </p>
      <Pre>{`# Gemfile
gem "smeditor"`}</Pre>
      <Pre>{`<%= smeditor_editor form, :content %>`}</Pre>
      <p>
        Keep persisted content in your application model as HTML, JSON, or both.
        Server-side rendering must pass stored HTML through the Rails sanitizer
        before output.
      </p>
      <Note>
        The Rails adapter is not the editor core. It should not contain schema,
        command or document-model logic.
      </Note>
    </article>
  );
}


function AdvancedBacklog() {
  return (
    <article>
      <h1>Advanced / Pro backlog</h1>
      <p>
        The backlog is deliberately outside the MVP. These features should stay
        opt-in, should not be required for <Code>StarterKit</Code>, and should
        not add core runtime requirements unless the same core change is needed
        by the MVP.
      </p>
      <h2>Deferred features</h2>
      <ApiTable
        rows={[
          ["Collaboration", "Transport-neutral sessions, conflict handling and presence lifecycle."],
          ["Comments", "Host-owned thread storage with durable editor anchors/marks."],
          ["Track changes", "Live input interception, review state and accept/reject UI."],
          ["AI writing assistant", "Provider-agnostic callbacks with explicit host opt-in for network calls."],
          ["Slash commands", "Command discovery, keyboard navigation and accessibility coverage."],
          ["Block editor mode", "Block selection, drag handles, transforms and mobile behaviour."],
          ["Markdown editor mode", "Source/editor sync and clear persistence rules."],
          ["Real-time cursors", "Collaboration transport and remote selection mapping."],
          ["Content versioning", "Host persistence boundaries and history snapshot semantics."],
          ["Grammar suggestions", "Provider-agnostic suggestions without implicit content sharing."],
          ["Document templates", "Template schema, insertion rules and examples."],
          ["Export to PDF", "Separate package with explicit style/layout limitations."],
          ["Import from DOCX", "Sanitizer, mapping rules and unsupported-content reporting."],
          ["Advanced tables", "Merge cells, split cells, drag resize and complex selection."],
          ["Embeds", "URL allowlists, sandboxing rules and SSR-safe rendering."],
        ]}
      />
      <Note>
        A backlog feature leaves this page only after it has commands,
        serialization, tests, docs and an example. Until then it must not be a
        dependency of the MVP acceptance path.
      </Note>
    </article>
  );
}

function Troubleshooting() {
  return (
    <article>
      <h1>Troubleshooting</h1>
      <ApiTable
        rows={[
          ["A toolbar button is missing", "Confirm the extension that registers its command is present in the editor's extensions list."],
          ["A toolbar button is disabled", "Check editability, selection and command-specific availability such as canUndo/canRedo."],
          ["Formatting disappears after save/load", "Use the same extension set when parsing saved HTML and when editing it again."],
          ["Image paste/drop does nothing", "Configure ImageExtension with an upload handler or insert images by URL."],
          ["Link or image URL is rejected", "Unsafe protocols and malformed URLs are intentionally dropped by extension sanitizers."],
          ["Styles do not appear", "Import @smeditor/theme-default or provide equivalent CSS for SMEditor class names."],
          ["React toolbar does not refresh", "Wrap toolbar and content with EditorProvider and pass the current editor/version from useEditor."],
          ["Tests do not start", "Install workspace dependencies with pnpm install before running pnpm test or pnpm test:e2e."],
        ]}
      />
    </article>
  );
}

// ---------------------------------------------------------------------------
// Page registry
// ---------------------------------------------------------------------------

export interface DocPage {
  id: string;
  title: string;
  render: () => ReactNode;
}

export const PAGES: DocPage[] = [
  { id: "introduction", title: "Introduction", render: () => <Introduction /> },
  { id: "installation", title: "Installation", render: () => <Installation /> },
  { id: "quick-start", title: "Quick start", render: () => <QuickStart /> },
  { id: "core-concepts", title: "Core concepts", render: () => <CoreConcepts /> },
  { id: "react", title: "React usage", render: () => <ReactUsage /> },
  { id: "extensions", title: "Extensions and commands", render: () => <ExtensionsAndCommands /> },
  { id: "bundles", title: "StarterKit and FullKit", render: () => <Bundles /> },
  { id: "toolbar", title: "Toolbar", render: () => <Toolbar /> },
  { id: "html-json", title: "HTML and JSON", render: () => <HtmlJson /> },
  { id: "tables-images-colors", title: "Tables, images, colors", render: () => <TablesImagesColors /> },
  { id: "api", title: "API reference", render: () => <ApiReference /> },
  { id: "rails", title: "Rails integration", render: () => <RailsIntegration /> },
  { id: "advanced-backlog", title: "Advanced / Pro backlog", render: () => <AdvancedBacklog /> },
  { id: "troubleshooting", title: "Troubleshooting", render: () => <Troubleshooting /> },
];
