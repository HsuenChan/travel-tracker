import React from "react";

interface IconProps {
  size?: number;
  className?: string;
  stroke?: string;
  strokeWidth?: number | string;
}

export function PlaneIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2.2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 13.5l-6-4v-5c0-1.6-1.4-3-3-3s-3 1.4-3 3v5l-6 4c-0.6 0.4-0.8 1.1-0.4 1.7s1.1 0.8 1.7 0.4l4.7-2.1 1.2 4.1-2.1 1.7c-0.4 0.3-0.5 0.9-0.2 1.3 0.2 0.2 0.4 0.3 0.7 0.3 0.2 0 0.4-0.1 0.6-0.2l2.3-1 2.3 1c0.2 0.1 0.4 0.2 0.6 0.2 0.3 0 0.5-0.1 0.7-0.3 0.3-0.4 0.2-1-0.2-1.3l-2.1-1.7 1.2-4.1 4.7 2.1c0.2 0.1 0.5 0.2 0.8 0.2 0.3 0 0.7-0.1 0.9-0.5 0.4-0.6 0.2-1.3-0.4-1.7z" transform="rotate(45 12 12)" />
    </svg>
  );
}

export function PlusIcon({ size = 12, className, stroke = "currentColor", strokeWidth = 2.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" className={className}>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function GlobeIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function CalendarIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

export function LocationIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function GridIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

export function MenuListIcon({ size = 15, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function LogoutIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

export function FileIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  );
}

export function ShareIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function UserPlusIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
    </svg>
  );
}

export function UsersIcon({ size = 11, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function EditIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

export function TrashIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
    </svg>
  );
}

export function ChevronLeftIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function CurrencyIcon({ size = 11, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

export function CreditCardIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" /><line x1="2" y1="10" x2="22" y2="10" />
    </svg>
  );
}

export function PhotoIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function MapIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" /><line x1="8" y1="2" x2="8" y2="18" /><line x1="16" y1="6" x2="16" y2="22" />
    </svg>
  );
}

export function LinkBrokenIcon({ size = 24, className, stroke = "#f87171", strokeWidth = 1.8 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function CloseIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2.5 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" className={className}>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function CatTransportIcon({ size = 12, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="13" rx="2" /><line x1="3" y1="11" x2="21" y2="11" />
      <line x1="7" y1="16" x2="7" y2="20" /><line x1="17" y1="16" x2="17" y2="20" /><line x1="7" y1="20" x2="17" y2="20" />
    </svg>
  );
}

export function CatHotelIcon({ size = 12, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 20V8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v12" /><path d="M2 20h20" />
      <path d="M12 6V2" /><path d="M7 10h2v4H7z" /><path d="M15 10h2v4h-2z" />
    </svg>
  );
}

export function CatFoodIcon({ size = 12, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><line x1="7" y1="2" x2="7" y2="22" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3z" /><line x1="21" y1="15" x2="21" y2="22" />
    </svg>
  );
}

export function CatAttractionIcon({ size = 12, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

export function CatShoppingIcon({ size = 12, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  );
}

export function CatActivityIcon({ size = 12, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}

export function MoreHorizontalIcon({ size = 12, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1" fill={stroke} stroke="none" /><circle cx="19" cy="12" r="1" fill={stroke} stroke="none" /><circle cx="5" cy="12" r="1" fill={stroke} stroke="none" />
    </svg>
  );
}

export function MoreVerticalIcon({ size = 12, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="1" fill={stroke} stroke="none" /><circle cx="12" cy="19" r="1" fill={stroke} stroke="none" /><circle cx="12" cy="5" r="1" fill={stroke} stroke="none" />
    </svg>
  );
}

export function CatOtherIcon(props: IconProps) {
  return <MoreHorizontalIcon {...props} />;
}

const CATEGORY_BADGE_CONFIG: Record<string, {
  label: string;
  icon: React.ComponentType<{ size?: number; stroke?: string; strokeWidth?: number }>;
  color: string;
  bg: string;
}> = {
  flight:     { label: "機票", icon: PlaneIcon,          color: "#38bdf8", bg: "rgba(14,165,233,0.12)" },
  transport:  { label: "交通", icon: CatTransportIcon,  color: "#60a5fa", bg: "rgba(59,130,246,0.12)" },
  hotel:      { label: "住宿", icon: CatHotelIcon,      color: "#a78bfa", bg: "rgba(139,92,246,0.12)" },
  food:       { label: "餐飲", icon: CatFoodIcon,       color: "#fbbf24", bg: "rgba(245,158,11,0.12)" },
  attraction: { label: "景點", icon: CatAttractionIcon, color: "#34d399", bg: "rgba(16,185,129,0.12)" },
  shopping:   { label: "購物", icon: CatShoppingIcon,   color: "#f472b6", bg: "rgba(236,72,153,0.12)" },
  activity:   { label: "活動", icon: CatActivityIcon,   color: "#fb923c", bg: "rgba(249,115,22,0.12)" },
  outdoor:    { label: "戶外", icon: MountainIcon,      color: "#34d399", bg: "rgba(16,185,129,0.12)" },
  other:      { label: "其他", icon: CatOtherIcon,      color: "#a1a1aa", bg: "rgba(113,113,122,0.12)" },
};

export function CategoryBadge({ category }: { category: string }) {
  const cfg = CATEGORY_BADGE_CONFIG[category];
  if (!cfg) return <span className="text-xs text-zinc-500">{category}</span>;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold shrink-0"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Icon size={10} stroke={cfg.color} strokeWidth={2.5} />
      {cfg.label}
    </span>
  );
}

export function CategoryIcon({ category, size = 11 }: { category: string; size?: number }) {
  const cfg = CATEGORY_BADGE_CONFIG[category];
  if (!cfg) return null;
  const Icon = cfg.icon;
  return <Icon size={size} stroke={cfg.color} strokeWidth={2.5} />;
}

export function NotepadIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

export function GiftIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="20 12 20 22 4 22 4 12" />
      <rect x="2" y="7" width="20" height="5" />
      <line x1="12" y1="22" x2="12" y2="7" />
      <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
      <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
    </svg>
  );
}

export function LineBotIcon({ size = 14, className }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.282.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" className="shrink-0" aria-hidden="true">
      <path
        fill="white"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="rgba(255,255,255,0.85)"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="rgba(255,255,255,0.7)"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z"
      />
      <path
        fill="rgba(255,255,255,0.9)"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
export function TrainIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="3" width="16" height="14" rx="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
      <line x1="4" y1="11" x2="20" y2="11" />
    </svg>
  );
}

export function BusIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M8 6v6" />
      <path d="M15 6v6" />
      <path d="M2 12h19.6" />
      <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3" />
      <circle cx="7" cy="18" r="2" />
      <path d="M9 18h5" />
      <circle cx="16" cy="18" r="2" />
    </svg>
  );
}

export function FerryIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
      <path d="M19 13V7a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v6" />
      <line x1="12" y1="10" x2="12" y2="14" />
    </svg>
  );
}

export function CarIcon({ size = 14, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M19 17H5v-5.5l1.89-5.29A2 2 0 0 1 8.76 5h6.48a2 2 0 0 1 1.87 1.21L19 11.5V17Z" />
      <line x1="3" y1="17" x2="21" y2="17" />
      <circle cx="8" cy="18" r="1" />
      <circle cx="16" cy="18" r="1" />
    </svg>
  );
}

export function SparkleIcon({ size = 11, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3l1.9 5.8a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3z" />
    </svg>
  );
}

export function HealthIcon({ size = 12, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  );
}

/** WMO weather code → line icon（與 zinc/violet 深色調一致的單線條天氣圖示） */
export function WeatherIcon({ code, size = 12, className }: { code: number; size?: number; className?: string }) {
  const common = {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 2,
    strokeLinecap: "round" as const, strokeLinejoin: "round" as const, className,
  };
  const cloud = "M6.7 18h10.3a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 8.5 4.3 4.3 0 0 0 6.7 18z";
  if (code === 0) {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
      </svg>
    );
  }
  if (code <= 2) {
    return (
      <svg {...common}>
        <path d="M15.5 8.5a4 4 0 1 0-7.4-2" />
        <path d="M6.7 20h9.3a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 10.5 4.3 4.3 0 0 0 6.7 20z" />
      </svg>
    );
  }
  if (code <= 48) {
    return <svg {...common}><path d={cloud} /></svg>;
  }
  if (code <= 67 || (code >= 80 && code <= 82)) {
    return (
      <svg {...common}>
        <path d="M6.7 15h10.3a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 5.5 4.3 4.3 0 0 0 6.7 15z" />
        <path d="M8 18.5l-.8 2M12 18.5l-.8 2M16 18.5l-.8 2" />
      </svg>
    );
  }
  if (code <= 86) {
    return (
      <svg {...common}>
        <path d="M6.7 15h10.3a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 5.5 4.3 4.3 0 0 0 6.7 15z" />
        <path d="M8 18.5h.01M12 20.5h.01M16 18.5h.01" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M6.7 13h10.3a4 4 0 0 0 .8-7.9A6 6 0 0 0 6.2 3.5 4.3 4.3 0 0 0 6.7 13z" />
      <path d="M13 13l-2.5 4h3L11 21" />
    </svg>
  );
}

export function CoinIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v11M14.8 9.2c-.5-.9-1.6-1.4-2.8-1.4-1.7 0-3 .9-3 2.1s1.3 2.1 3 2.1 3 .9 3 2.1-1.3 2.1-3 2.1c-1.2 0-2.3-.5-2.8-1.4" />
    </svg>
  );
}

/**
 * 攀岩 D 扣（旋鎖式）。實心造型，路徑由參考圖的黑色連通區域邊界追蹤 + Douglas-Peucker
 * 簡化而來（4 個區域：主體、旋鎖套環、上下兩個環帶），所以 18px 下三塊套環還分得出來。
 *
 * 與這套其他 icon 不同，這顆是 fill 而非 stroke：把 stroke prop 接到 fill，
 * 呼叫端沿用  這種寫法就不用改。strokeWidth 對實心造型無意義，會被忽略。
 */
export function CarabinerIcon({ size = 13, className, stroke = "currentColor" }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={stroke} className={className}>
      <path d="M11.75 1.5L13.09 1.5L14.28 1.75L15.52 2.29L16.67 3.14L17.56 4.18L18.26 5.52L18.6 6.86L18.65 8.15L18.16 10.19L13.99 18.33L13.84 19.62L13.44 20.61L12.5 21.71L11.7 22.2L10.66 22.5L9.42 22.5L7.93 21.95L6.74 20.76L6.19 19.27L6.19 17.49L8.82 17.44L8.82 18.93L9.02 19.37L9.47 19.77L9.82 19.87L10.71 19.72L11.26 19.02L11.55 17.24L15.72 9.1L15.97 8.25L15.87 6.76L15.23 5.52L14.04 4.53L12.65 4.13L11.5 4.23L10.26 4.83L9.17 6.12L8.82 7.66L6.19 7.66L6.19 6.91L6.54 5.52L7.58 3.73L8.62 2.74L9.67 2.1L11.75 1.5ZM5.99 10.19L8.97 10.19L9.52 10.54L9.62 14.36L9.32 14.8L5.89 14.9L5.55 14.71L5.35 14.31L5.35 10.78L5.65 10.34L5.99 10.19ZM6.54 8.25L8.67 8.3L9.07 8.7L9.12 9.54L5.89 9.59L5.89 8.7L6.14 8.4L6.54 8.25ZM5.84 15.55L9.12 15.55L9.12 16.29L8.62 16.84L6.34 16.84L5.89 16.39L5.84 15.55Z" />
    </svg>
  );
}

export function UploadIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function ArchiveIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3.5" width="18" height="5" rx="1.5" />
      <path d="M5 8.5v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-10" />
      <path d="M10 13h4" />
    </svg>
  );
}

export function MountainIcon({ size = 13, className, stroke = "currentColor", strokeWidth = 2 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M2 20h20L14.5 6.5 11 13l-2-3z" />
      <path d="M12.6 9.2 14.5 6.5l3 5.4" />
    </svg>
  );
}
