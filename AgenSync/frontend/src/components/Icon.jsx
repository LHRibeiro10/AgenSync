const paths = {
  dashboard: "M4 13h7V4H4v9Zm9 7h7V4h-7v16ZM4 20h7v-5H4v5Z",
  agenda:
    "M7 2v3M17 2v3M4 8h16M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  appointments:
    "M9 11l2 2 4-5M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  clients:
    "M16 11a4 4 0 1 0-8 0M4 20a8 8 0 0 1 16 0M18 8a3 3 0 0 1 2.8 4",
  professionals:
    "M16 11a4 4 0 1 0-8 0M4 21a8 8 0 0 1 16 0M18 8a3 3 0 0 1 3 3M5 7h3M5 4v6",
  services:
    "M12 3l2.2 4.5 5 .7-3.6 3.5.8 5-4.4-2.4-4.4 2.4.8-5L4 8.2l5-.7L12 3Z",
  history:
    "M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5M12 8v5l3 2",
  finance:
    "M4 7h16M6 7V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2M5 7l1 13h12l1-13M9 11h6",
  expenses:
    "M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2V5a2 2 0 0 1 2-2ZM9 8h6M9 12h6M9 16h3",
  products:
    "M21 8.5 12 3 3 8.5v7L12 21l9-5.5v-7ZM3.5 9 12 14l8.5-5M12 14v6.5",
  sales:
    "M4 6h16M7 6V4h10v2M6 6l1 14h10l1-14M9 11h6M9 15h3",
  reports:
    "M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM14 3v5h5M8 13h8M8 17h5",
  message:
    "M21 12a8 8 0 0 1-8 8H7l-4 2 1.5-4A8 8 0 1 1 21 12ZM8 11h8M8 15h5",
  check: "m5 12 4 4L19 6",
  user: "M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z",
  mail: "M4 6h16v12H4V6Zm0 1 8 6 8-6",
  building: "M4 21V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v16M9 21v-5h3v5M7 7h1M7 11h1M12 7h1M12 11h1M3 21h18",
  settings:
    "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 0 1 4.2 17l.1-.1A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.6-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 0 1 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 0 1 19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1a2 2 0 0 1 0 4H21a1.7 1.7 0 0 0-1.6 1Z",
  manicure:
    "M7 4l2 6M17 4l-2 6M5 15h14M7 20h10M9 10h6a4 4 0 0 1 4 4v1H5v-1a4 4 0 0 1 4-4Z",
  barber:
    "M4 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM14 7a3 3 0 1 0 6 0 3 3 0 0 0-6 0ZM8.5 9.5 19 20M15.5 9.5 5 20",
  aesthetics:
    "M12 3c4 3 6 6.2 6 9.2A6 6 0 0 1 6 12.2C6 9.2 8 6 12 3ZM9 13h6M10 16h4",
  hairdresser:
    "M4 18c4-1 4-6 8-6s4 5 8 6M6 14c2-7 10-9 12-2M9 20h6"
};

export default function Icon({ name, className = "h-5 w-5" }) {
  const path = paths[name] || paths.dashboard;
  const isFilled = name === "dashboard" || name === "services";

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill={isFilled ? "currentColor" : "none"}
      stroke={isFilled ? "none" : "currentColor"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
