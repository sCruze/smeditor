/**
 * Generic dropdown menu used by the toolbar.
 *
 * Behaviour:
 *  - The trigger is rendered as-is; clicking it toggles the popover.
 *  - Clicking outside the popover closes it.
 *  - Pressing Escape closes it.
 *  - Arrow keys move focus through menu items when the menu is open.
 *  - Each item closes the menu when activated (unless the item passes
 *    `keepOpen`).
 *
 * Positioning is plain CSS — `position: absolute; top: 100%` under the
 * trigger. No floating-ui dependency; collisions with the viewport
 * edge are handled by the consumer passing `align="right"`.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  ButtonHTMLAttributes,
  MouseEvent as ReactMouseEvent,
} from "react";

// ---------------------------------------------------------------------------
// Context that lets items close the menu after activating.
// ---------------------------------------------------------------------------
const DropdownCloseContext = createContext<() => void>(() => {});

function enabledMenuItems(root: HTMLElement | null): HTMLButtonElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"], [role="menuitemcheckbox"]',
    ),
  ).filter(
    (item) => !item.disabled && item.getAttribute("aria-disabled") !== "true",
  );
}

function focusMenuItem(
  root: HTMLElement | null,
  direction: "first" | "last" | "next" | "previous",
) {
  const items = enabledMenuItems(root);
  if (items.length === 0) return;

  const activeIndex = items.indexOf(document.activeElement as HTMLButtonElement);
  const nextIndex = (() => {
    if (direction === "first") return 0;
    if (direction === "last") return items.length - 1;
    if (activeIndex < 0) return direction === "next" ? 0 : items.length - 1;
    return direction === "next"
      ? (activeIndex + 1) % items.length
      : (activeIndex - 1 + items.length) % items.length;
  })();

  items[nextIndex]?.focus();
}

// ---------------------------------------------------------------------------
// <Dropdown />
// ---------------------------------------------------------------------------

export interface DropdownProps {
  /** Content of the trigger button (the label/icon you see). */
  label: ReactNode;
  /** Optional summary shown next to the chevron — e.g. "H2" or "•". */
  summary?: ReactNode;
  /** Accessible name for the trigger. */
  ariaLabel: string;
  /** Items / sections to show in the popover. */
  children: ReactNode;
  /** "left" anchors menu to trigger's left edge, "right" to right edge. */
  align?: "left" | "right";
  /** When true, render the trigger in the active visual state. */
  active?: boolean;
  /** When true, keep the menu visible but unavailable. */
  disabled?: boolean;
  className?: string;
}

export function Dropdown({
  label,
  summary,
  ariaLabel,
  children,
  align = "left",
  active,
  disabled = false,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();

  const focusFirst = useCallback(() => {
    requestAnimationFrame(() => focusMenuItem(wrapperRef.current, "first"));
  }, []);

  const focusLast = useCallback(() => {
    requestAnimationFrame(() => focusMenuItem(wrapperRef.current, "last"));
  }, []);

  // Close on click outside the wrapper.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapperRef.current) return;
      if (e.target instanceof Node && wrapperRef.current.contains(e.target)) {
        return;
      }
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      focusFirst();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      focusLast();
    }
  };

  const onMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(wrapperRef.current, "next");
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(wrapperRef.current, "previous");
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(wrapperRef.current, "first");
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(wrapperRef.current, "last");
    } else if (event.key === "Escape") {
      event.preventDefault();
      close();
    }
  };

  return (
    <div
      ref={wrapperRef}
      className={[
        "smeditor-dropdown",
        open ? "is-open" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={ariaLabel}
        aria-disabled={disabled}
        disabled={disabled}
        data-active={active ? "true" : "false"}
        className={[
          "smeditor-button",
          "smeditor-dropdown__trigger",
          active ? "is-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (!disabled) setOpen((v) => !v);
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="smeditor-dropdown__label">{label}</span>
        {summary !== undefined && (
          <span className="smeditor-dropdown__summary">{summary}</span>
        )}
        <span className="smeditor-dropdown__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <DropdownCloseContext.Provider value={close}>
          <div
            id={menuId}
            role="menu"
            aria-label={ariaLabel}
            className={[
              "smeditor-dropdown__menu",
              align === "right" ? "is-right" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onKeyDown={onMenuKeyDown}
          >
            {children}
          </div>
        </DropdownCloseContext.Provider>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// <DropdownItem />
// ---------------------------------------------------------------------------

export interface DropdownItemProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Pressed / selected visual state. */
  active?: boolean;
  /** Leading icon. */
  icon?: ReactNode;
  /** Optional trailing hint like "⌘⌥1". */
  shortcut?: ReactNode;
  /** Click handler — receives the original event. */
  onSelect: (e: ReactMouseEvent<HTMLButtonElement>) => void;
  /** When true, keep the menu open after activation. */
  keepOpen?: boolean;
  children: ReactNode;
}

export function DropdownItem({
  active,
  icon,
  shortcut,
  onSelect,
  keepOpen,
  children,
  disabled,
  ...rest
}: DropdownItemProps) {
  const close = useContext(DropdownCloseContext);
  const role = active === undefined ? "menuitem" : "menuitemcheckbox";
  return (
    <button
      {...rest}
      type="button"
      role={role}
      aria-checked={active === undefined ? undefined : active}
      aria-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      data-active={active ? "true" : "false"}
      className={[
        "smeditor-dropdown__item",
        active ? "is-active" : "",
        rest.className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => {
        if (disabled) return;
        onSelect(e);
        if (!keepOpen) close();
      }}
    >
      {icon !== undefined && (
        <span className="smeditor-dropdown__item-icon" aria-hidden="true">
          {icon}
        </span>
      )}
      <span className="smeditor-dropdown__item-label">{children}</span>
      {shortcut !== undefined && (
        <span className="smeditor-dropdown__item-shortcut">{shortcut}</span>
      )}
    </button>
  );
}

/** Visual divider between groups of items. */
export function DropdownSeparator() {
  return (
    <div
      className="smeditor-dropdown__separator"
      role="separator"
      aria-hidden="true"
    />
  );
}
