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
  heart: "M12 20.5S3.5 15 3.5 8.9A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.3C20.5 15 12 20.5 12 20.5z",
  reply: "M10 15l-5-5 5-5M5 10h9a5 5 0 0 1 5 5v3",
  comment: "M4 5h16v11H9l-5 4z",
  bookmark: "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z",
  rss: "M4 11a9 9 0 0 1 9 9M4 4a16 16 0 0 1 16 16M5 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  calendar: "M4 6h16v15H4zM4 10h16M9 3v4M15 3v4",
  share: "M4 13v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 3v12M8 7l4-4 4 4",
  download: "M12 4v12M8 12l4 4 4-4M4 20h16",
  flag: "M5 21V4h12l-2 4 2 4H5",
  menu: "M4 7h16M4 12h16M4 17h16",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6",
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
