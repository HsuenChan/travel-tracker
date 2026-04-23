import { toTransportKey } from "@/lib/transport";
import { PlaneIcon, TrainIcon, BusIcon, FerryIcon, CarIcon } from "@/app/components/Icons";
import React from "react";

interface Props {
  type: string;
  size?: number;
}

const CONFIG: Record<string, { 
  color: string; 
  bg: string; 
  border: string; 
  icon: React.ComponentType<{ size?: number; stroke?: string; strokeWidth?: number | string; className?: string }> 
}> = {
  plane: {
    color: "#a78bfa",
    bg: "rgba(139,92,246,0.15)",
    border: "rgba(139,92,246,0.25)",
    icon: PlaneIcon,
  },
  train: {
    color: "#5eead4",
    bg: "rgba(45,212,191,0.12)",
    border: "rgba(45,212,191,0.22)",
    icon: TrainIcon,
  },
  bus: {
    color: "#86efac",
    bg: "rgba(134,239,172,0.12)",
    border: "rgba(134,239,172,0.22)",
    icon: BusIcon,
  },
  ferry: {
    color: "#93c5fd",
    bg: "rgba(96,165,250,0.12)",
    border: "rgba(96,165,250,0.22)",
    icon: FerryIcon,
  },
  other: {
    color: "#fda4af",
    bg: "rgba(251,113,133,0.12)",
    border: "rgba(251,113,133,0.22)",
    icon: CarIcon,
  },
};

export default function VehicleIconChip({ type, size = 36 }: Props) {
  const key = toTransportKey(type);
  const c = CONFIG[key] || CONFIG.other;
  const iconSize = Math.round(size * 0.5);
  const Icon = c.icon;

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
      <Icon size={iconSize} stroke={c.color} strokeWidth={1.8} />
    </div>
  );
}
