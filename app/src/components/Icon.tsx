const PATHS = {
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  search: "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15z",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  settings: "M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M8 16v4",
  upload: "M12 16V4M6 10l6-6 6 6M4 20h16",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  left: "M15 5l-7 7 7 7",
  right: "M9 5l7 7-7 7",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  play: "M8 5v14l11-7z",
} as const;

export type IconName = keyof typeof PATHS;

export default function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
