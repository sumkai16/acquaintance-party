"use client";

import Link from "next/link";

/**
 * One round icon button in a table row's Actions column, with its label in a
 * tooltip on hover or keyboard focus.
 *
 * Colour carries the meaning, not just the shape: neutral for "go look at
 * something", blue for editing, gold for sending, clay for the destructive
 * one. The tints are theme tokens rather than raw hex (context/DESIGN.md §0),
 * and blue follows badge.tsx's precedent of borrowing a Tailwind default
 * where the palette has no token of its own.
 */
const TONES = {
  neutral: "bg-ground/5 text-ground hover:bg-ground/15",
  blue: "bg-blue-500/15 text-blue-300 hover:bg-blue-500/25",
  gold: "bg-accent-2/20 text-accent-2 hover:bg-accent-2/30",
  clay: "bg-accent/20 text-accent hover:bg-accent/30",
} as const;

const BUTTON_CLASS =
  "flex h-[30px] w-[30px] items-center justify-center rounded-full transition-colors " +
  "disabled:opacity-40 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2";

function Tooltip({ label }: { label: string }) {
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 rounded-[5px] bg-neutral-900 px-[9px] py-[5px] text-[10px] font-semibold whitespace-nowrap text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {label}
    </span>
  );
}

type Props = {
  label: string;
  tone?: keyof typeof TONES;
  icon: React.ReactNode;
};

export function IconActionButton({
  label,
  tone = "neutral",
  icon,
  onClick,
  disabled,
}: Props & { onClick: () => void; disabled?: boolean }) {
  return (
    <span className="group relative inline-flex">
      <Tooltip label={label} />
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={label}
        className={`${BUTTON_CLASS} ${TONES[tone]}`}
      >
        {icon}
      </button>
    </span>
  );
}

export function IconActionLink({
  label,
  tone = "neutral",
  icon,
  href,
  newTab = false,
}: Props & { href: string; newTab?: boolean }) {
  const className = `${BUTTON_CLASS} ${TONES[tone]}`;
  return (
    <span className="group relative inline-flex">
      <Tooltip label={label} />
      {newTab ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label={label}
          className={className}
        >
          {icon}
        </a>
      ) : (
        <Link href={href} aria-label={label} className={className}>
          {icon}
        </Link>
      )}
    </span>
  );
}

/* Feather-style line icons, 2px stroke, sized to sit inside a 30px circle. */

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "h-[13px] w-[13px]",
  "aria-hidden": true,
};

export const ArrowRightIcon = (
  <svg {...SVG_PROPS}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export const EyeIcon = (
  <svg {...SVG_PROPS}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

export const PencilIcon = (
  <svg {...SVG_PROPS}>
    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
    <path d="M14.5 5.5 18.5 9.5" />
  </svg>
);

export const MailIcon = (
  <svg {...SVG_PROPS}>
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const TrashIcon = (
  <svg {...SVG_PROPS}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);
