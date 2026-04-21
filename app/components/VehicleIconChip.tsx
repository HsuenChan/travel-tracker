import { toTransportKey } from "@/lib/transport";

interface Props {
  type: string;
  size?: number;
}

const CONFIG = {
  plane: {
    color: "#a78bfa",
    bg: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.25)",
    icon: (
      <path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7l-8.2-1.8L3 7l7 4L8 14l-4 1 3 3 1-4 4-2 4 7z" />
    ),
  },
  train: {
    color: "#5eead4",
    bg: "rgba(45,212,191,0.12)",
    border: "rgba(45,212,191,0.22)",
    icon: (
      <>
        <rect x="4" y="3" width="16" height="14" rx="2" />
        <line x1="8" y1="21" x2="16" y2="21" />
        <line x1="12" y1="17" x2="12" y2="21" />
        <line x1="4" y1="11" x2="20" y2="11" />
      </>
    ),
  },
  bus: {
    color: "#86efac",
    bg: "rgba(134,239,172,0.12)",
    border: "rgba(134,239,172,0.22)",
    icon: (
      <>
        <path d="M8 6v6" />
        <path d="M15 6v6" />
        <path d="M2 12h19.6" />
        <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
        <circle cx="7" cy="18" r="2" />
        <path d="M9 18h5" />
        <circle cx="16" cy="18" r="2" />
      </>
    ),
  },
  ferry: {
    color: "#93c5fd",
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.22)",
    icon: (
      <>
        <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
        <path d="M19 13V7a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v6" />
        <path d="M12 10v4" />
      </>
    ),
  },
  other: {
    color: "#fda4af",
    bg: "rgba(251,113,133,0.12)",
    border: "rgba(251,113,133,0.22)",
    icon: (
      <>
        <path d="M19 17H5v-5.5l1.89-5.29A2 2 0 0 1 8.76 5h6.48a2 2 0 0 1 1.87 1.21L19 11.5V17Z" />
        <line x1="3" y1="17" x2="21" y2="17" />
        <circle cx="8" cy="18" r="1" />
        <circle cx="16" cy="18" r="1" />
      </>
    ),
  },
};

export default function VehicleIconChip({ type, size = 36 }: Props) {
  const key = toTransportKey(type);
  const c = CONFIG[key];
  const iconSize = Math.round(size * 0.5);

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.33),
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: c.bg,
        border: `1px solid ${c.border}`,
      }}
    >
      <svg
        width={iconSize}
        height={iconSize}
        viewBox="0 0 24 24"
        fill="none"
        stroke={c.color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {c.icon}
      </svg>
    </div>
  );
}
