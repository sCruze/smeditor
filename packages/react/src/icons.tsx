/**
 * Inline SVG icon set used by the default toolbar.
 *
 * 16×16, `currentColor` strokes — inherit text color and respect
 * active-state styling. No icon-font dependency, no external SVG
 * sprites.
 */

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Svg({
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {children}
    </svg>
  );
}

// History --------------------------------------------------------------
export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 8h7a3 3 0 0 1 0 6H6" />
    <path d="m6 4-3 4 3 4" />
  </Svg>
);

export const IconRedo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12.5 8h-7a3 3 0 0 0 0 6H10" />
    <path d="m10 4 3 4-3 4" />
  </Svg>
);

// Marks ----------------------------------------------------------------
export const IconBold = (p: IconProps) => (
  <Svg {...p} strokeWidth="2">
    <path d="M4 3h4.5a2.5 2.5 0 0 1 0 5H4z" />
    <path d="M4 8h5a2.5 2.5 0 0 1 0 5H4z" />
  </Svg>
);

export const IconItalic = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 3 6 13" />
    <path d="M6 3h5" />
    <path d="M5 13h5" />
  </Svg>
);

export const IconStrike = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 8h10" />
    <path d="M5.5 4.5C6 4 6.7 3.5 8 3.5c2 0 3 1 3 2.5" />
    <path d="M5 11c0 1.4 1.3 2.5 3 2.5 1.8 0 3-1 3-2.2" />
  </Svg>
);

export const IconUnderline = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 3v5a4 4 0 0 0 8 0V3" />
    <path d="M3.5 13.5h9" />
  </Svg>
);

export const IconInlineCode = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 5-3 3 3 3" />
    <path d="m10 5 3 3-3 3" />
  </Svg>
);

export const IconSubscript = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4l4 5" />
    <path d="M7 4l-4 5" />
    <text x="9" y="14" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">
      x
    </text>
  </Svg>
);

export const IconSuperscript = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6l4 5" />
    <path d="M7 6l-4 5" />
    <text x="9" y="7" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">
      x
    </text>
  </Svg>
);

export const IconEraser = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 3 5 5-6 6H4l-1-1z" />
    <path d="m6 6 5 5" />
    <path d="M9 14h5" />
  </Svg>
);

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 9a3 3 0 0 0 4 0l2-2a3 3 0 1 0-4-4L8 4" />
    <path d="M9 7a3 3 0 0 0-4 0l-2 2a3 3 0 1 0 4 4l1-1" />
  </Svg>
);

export const IconHighlight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 13l3-1 6-6-2-2-6 6z" />
    <path d="M2 14h12" />
  </Svg>
);

export const IconTextColor = (p: IconProps) => (
  <Svg {...p}>
    <text x="3" y="11" fontSize="9" fontWeight="700" fill="currentColor" stroke="none">
      A
    </text>
    <rect x="3" y="13" width="10" height="2" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconBackgroundColor = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="2" width="12" height="12" rx="1.5" />
    <path d="M2 2l12 12" />
  </Svg>
);

// Blocks ---------------------------------------------------------------
export const IconBlockquote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 5v3c0 1.5-.7 2.5-2 3" />
    <path d="M9 5v3c0 1.5-.7 2.5-2 3" />
  </Svg>
);

export const IconCodeBlock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
    <path d="m5 6.5-2 1.5 2 1.5" />
    <path d="m11 6.5 2 1.5-2 1.5" />
  </Svg>
);

export const IconHorizontalRule = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 8h12" />
    <path d="M2 4h8" />
    <path d="M2 12h6" />
  </Svg>
);

export const IconBulletList = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="3.5" cy="4.5" r=".7" fill="currentColor" />
    <circle cx="3.5" cy="8" r=".7" fill="currentColor" />
    <circle cx="3.5" cy="11.5" r=".7" fill="currentColor" />
    <path d="M6 4.5h7M6 8h7M6 11.5h7" />
  </Svg>
);

export const IconOrderedList = (p: IconProps) => (
  <Svg {...p}>
    <text x="2" y="6" fontSize="4" fontFamily="monospace" fill="currentColor" stroke="none">
      1.
    </text>
    <text x="2" y="13" fontSize="4" fontFamily="monospace" fill="currentColor" stroke="none">
      2.
    </text>
    <path d="M6 4.5h7M6 11.5h7" />
  </Svg>
);

export const IconTaskList = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="3" height="3" rx=".5" />
    <path d="m2.5 4.5 1 1 1.5-1.5" />
    <rect x="2" y="10" width="3" height="3" rx=".5" />
    <path d="M7 4.5h6M7 11.5h6" />
  </Svg>
);

// Alignment ------------------------------------------------------------
export const IconAlignLeft = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11M2.5 7h7M2.5 10h11M2.5 13h7" />
  </Svg>
);

export const IconAlignCenter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11M4.5 7h7M2.5 10h11M4.5 13h7" />
  </Svg>
);

export const IconAlignRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11M6.5 7h7M2.5 10h11M6.5 13h7" />
  </Svg>
);

export const IconAlignJustify = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 4h11M2.5 7h11M2.5 10h11M2.5 13h11" />
  </Svg>
);

// Indent ---------------------------------------------------------------
export const IconIndent = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 4h12M7 8h7M2 12h12" />
    <path d="m2 7 2 1.5L2 10" fill="currentColor" />
  </Svg>
);

export const IconOutdent = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 4h12M7 8h7M2 12h12" />
    <path d="m6 7-2 1.5L6 10" fill="currentColor" />
  </Svg>
);

// Type labels ----------------------------------------------------------
export const IconHeading = (p: IconProps & { level?: number }) => {
  const { level = 2, ...rest } = p;
  return (
    <Svg {...rest}>
      <text x="2" y="12" fontFamily="sans-serif" fontSize="9" fontWeight="700" fill="currentColor" stroke="none">
        H
      </text>
      <text x="9.5" y="13" fontFamily="sans-serif" fontSize="6" fontWeight="700" fill="currentColor" stroke="none">
        {level}
      </text>
    </Svg>
  );
};

export const IconParagraph = (p: IconProps) => (
  <Svg {...p}>
    <text x="3" y="12" fontFamily="serif" fontSize="11" fontWeight="700" fill="currentColor" stroke="none">
      ¶
    </text>
  </Svg>
);

export const IconMore = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
  </Svg>
);

// Theme switcher -------------------------------------------------------
export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5L13 13M3 13l1.5-1.5M11.5 4.5L13 3" />
  </Svg>
);

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.5 4.5 0 0 0 6.5 6.5z" />
  </Svg>
);

// Media ----------------------------------------------------------------
export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1.5" />
    <circle cx="5.5" cy="6.5" r="1.2" />
    <path d="m2.5 11 3.5-3.5 2.5 2.5L11 7.5l2.5 2.5" />
  </Svg>
);

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 4.5h10" />
    <path d="M5.5 4.5V3h5v1.5" />
    <path d="M4.5 4.5 5 13h6l.5-8.5" />
  </Svg>
);

export const IconTable = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1" />
    <path d="M2 6.5h12M2 10h12M6 3v10M10 3v10" />
  </Svg>
);

