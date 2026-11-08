import type { CSSProperties } from "react";

const paths = {
  plus: "M12 5v14M5 12h14",
  search: "M21 21l-4.5-4.5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0",
  panel: "M8 3v18M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1",
  chat: "M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l-3 2V11.5a10 10 0 1 1 20 0Z",
  arrow: "M12 19V5M6 11l6-6 6 6",
  chevron: "m9 5 7 7-7 7",
  down: "m6 9 6 6 6-6",
  close: "m6 6 12 12M6 18 18 6",
  paperclip: "m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9M7 13l7-7",
  write: "m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14v6Z",
  idea: "M9 18h6M9 21h6M8 14a7 7 0 1 1 8 0l-1 2H9l-1-2Z",
  code: "m8 7-5 5 5 5m8-10 5 5-5 5M14 4l-4 16",
  book: "M12 6v15M3 3h4a5 5 0 0 1 5 3 5 5 0 0 1 5-3h4v15h-4a5 5 0 0 0-5 3 5 5 0 0 0-5-3H3V3Z",
  settings: "M4 7h16M4 17h16M8 4v6m8 4v6",
  help: "M9.5 9a2.5 2.5 0 1 1 4 2l-1.5 1v1M12 17h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  file: "M14 2H5v20h14V7l-5-5Zm0 0v5h5M8 12h8m-8 4h5",
  check: "m5 12 4 4L19 6",
  copy: "M9 8h12v13H9V8ZM15 8V3H3v13h6",
  trash: "M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7",
  shield: "m12 2 8 4v6c0 5-8 10-8 10S4 17 4 12V6l8-4Zm-4 10 3 3 5-6",
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
export function Mark({ large = false }: { large?: boolean }) {
  return (
    <span className={`brand-mark${large ? " brand-mark--large" : ""}`} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <i key={i} style={{ "--turn": `${i * 30}deg` } as CSSProperties} />
      ))}
      <b />
    </span>
  );
}
