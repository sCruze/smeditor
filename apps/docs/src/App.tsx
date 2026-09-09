/**
 * Docs site shell — a sidebar of pages beside the selected page's
 * content. The current page is kept in the URL hash so links and
 * reloads work.
 */

import { useEffect, useState } from "react";
import { PAGES } from "./pages/content.js";

function pageFromHash(): string {
  const id = window.location.hash.replace(/^#\/?/, "");
  return PAGES.some((p) => p.id === id) ? id : PAGES[0].id;
}

export function App() {
  const [current, setCurrent] = useState<string>(pageFromHash);

  // Keep state and the URL hash in sync (back/forward, direct links).
  useEffect(() => {
    const onHash = () => setCurrent(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (id: string) => {
    window.location.hash = `/${id}`;
    setCurrent(id);
  };

  const page = PAGES.find((p) => p.id === current) ?? PAGES[0];

  return (
    <div className="docs">
      <aside className="docs__sidebar">
        <div className="docs__brand">
          SMEditor
          <span className="docs__brand-sub">docs</span>
        </div>
        <nav className="docs__nav">
          {PAGES.map((p) => (
            <button
              key={p.id}
              type="button"
              className={
                "docs__nav-item" + (p.id === current ? " is-active" : "")
              }
              onClick={() => go(p.id)}
            >
              {p.title}
            </button>
          ))}
        </nav>
        <div className="docs__sidebar-foot">
          Rich-text editor library
        </div>
      </aside>
      <main className="docs__content">{page.render()}</main>
    </div>
  );
}
