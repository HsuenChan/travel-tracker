"use client";

import type { CSSProperties, ReactNode } from "react";

/**
 * 把 Flex JSON 畫成 HTML。
 *
 * 只涵蓋這個專案實際用到的節點（box / text / separator / button）。它是近似值，改排版時夠用；
 * 要像素級精準就用畫面上那顆「複製 JSON」貼進 LINE 官方的 Flex Message Simulator。
 */

type Node = Record<string, unknown>;
type Layout = "horizontal" | "vertical" | "baseline";

const TEXT_SIZE: Record<string, number> = {
  xxs: 11, xs: 13, sm: 14, md: 16, lg: 19, xl: 22, xxl: 27, "3xl": 29, "4xl": 33, "5xl": 39,
};
const SPACE: Record<string, number> = { none: 0, xs: 2, sm: 4, md: 8, lg: 12, xl: 16, xxl: 20 };

function px(value: unknown, table: Record<string, number> = SPACE): number | undefined {
  if (typeof value !== "string") return undefined;
  if (value.endsWith("px")) return parseFloat(value);
  return table[value];
}

function background(node: Node): string | undefined {
  const bg = node.background as { type?: string; angle?: string; startColor?: string; centerColor?: string; endColor?: string } | undefined;
  if (bg?.type === "linearGradient") {
    const stops = [bg.startColor, bg.centerColor, bg.endColor].filter(Boolean).join(", ");
    return `linear-gradient(${bg.angle ?? "180deg"}, ${stops})`;
  }
  return node.backgroundColor as string | undefined;
}

/**
 * Flex 的 flex 預設值：水平 box 的子元素是 1，垂直的是 0。指定了 width 的視同 0，
 * 否則固定寬度的元素會被拉開。少了這條，水平列裡的文字會被壓成零寬而消失。
 */
function flexOf(node: Node, parentLayout: Layout): number {
  if (typeof node.flex === "number") return node.flex;
  if (typeof node.width === "string") return 0;
  return parentLayout === "horizontal" || parentLayout === "baseline" ? 1 : 0;
}

function sizing(node: Node, parentLayout: Layout): CSSProperties {
  const grow = flexOf(node, parentLayout);
  return { flexGrow: grow, flexShrink: grow > 0 ? 1 : 0, flexBasis: grow > 0 ? 0 : "auto" };
}

function boxStyle(node: Node, isFirst: boolean, parentLayout: Layout): CSSProperties {
  const horizontal = node.layout === "horizontal" || node.layout === "baseline";
  const pad = px(node.paddingAll);
  return {
    display: "flex",
    flexDirection: horizontal ? "row" : "column",
    alignItems: node.alignItems as CSSProperties["alignItems"],
    justifyContent: node.justifyContent as CSSProperties["justifyContent"],
    background: background(node),
    borderRadius: px(node.cornerRadius),
    width: typeof node.width === "string" ? node.width : undefined,
    height: typeof node.height === "string" ? node.height : undefined,
    ...sizing(node, parentLayout),
    paddingTop: px(node.paddingTop) ?? pad,
    paddingBottom: px(node.paddingBottom) ?? pad,
    paddingLeft: px(node.paddingStart) ?? pad,
    paddingRight: px(node.paddingEnd) ?? pad,
    marginTop: isFirst ? undefined : px(node.margin),
    gap: px(node.spacing),
    boxSizing: "border-box",
  };
}

function textStyle(node: Node, isFirst: boolean, parentLayout: Layout): CSSProperties {
  return {
    fontSize: px(node.size, TEXT_SIZE) ?? 16,
    color: (node.color as string) ?? "#000000",
    fontWeight: node.weight === "bold" ? 700 : 400,
    textAlign: node.align as CSSProperties["textAlign"],
    whiteSpace: node.wrap ? "pre-wrap" : "nowrap",
    overflow: node.wrap ? undefined : "hidden",
    textOverflow: node.wrap ? undefined : "ellipsis",
    lineHeight: 1.4,
    ...sizing(node, parentLayout),
    width: typeof node.width === "string" ? node.width : undefined,
    marginTop: isFirst ? undefined : px(node.margin),
  };
}

function buttonStyle(node: Node, isFirst: boolean, parentLayout: Layout): CSSProperties {
  const style = node.style ?? "link";
  const color = node.color as string | undefined;
  const base: CSSProperties = {
    display: "flex", alignItems: "center", justifyContent: "center",
    height: node.height === "sm" ? 40 : 52,
    borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: "pointer",
    border: "none", width: "100%",
    ...sizing(node, parentLayout),
    marginTop: isFirst ? undefined : px(node.margin),
  };
  if (style === "primary") return { ...base, background: color ?? "#17c950", color: "#ffffff" };
  // secondary 的文字顏色由 LINE 決定，是深色 —— 不能自己指定
  if (style === "secondary") return { ...base, background: color ?? "#dcdfe5", color: "#111111" };
  return { ...base, background: "transparent", color: color ?? "#0367d3" };
}

interface Props {
  node: Node;
  isFirst?: boolean;
  parentLayout?: Layout;
  onPostback?: (data: string) => void;
}

export function FlexNode({ node, isFirst = false, parentLayout = "vertical", onPostback }: Props): ReactNode {
  if (node.type === "box") {
    const contents = (node.contents as Node[] | undefined) ?? [];
    const layout = (node.layout as Layout) ?? "vertical";
    // box 也可以掛 action（每日行程整列點開地圖就是靠這個）
    const action = node.action as { type?: string; uri?: string; data?: string } | undefined;
    const style = boxStyle(node, isFirst, parentLayout);
    const children = contents.map((child, i) => (
      <FlexNode key={i} node={child} isFirst={i === 0} parentLayout={layout} onPostback={onPostback} />
    ));

    if (action?.type === "uri" && action.uri) {
      return (
        <a href={action.uri} target="_blank" rel="noreferrer" style={{ ...style, textDecoration: "none" }}>
          {children}
        </a>
      );
    }
    if (action?.type === "postback" && action.data) {
      return (
        <div style={{ ...style, cursor: "pointer" }} onClick={() => onPostback?.(action.data!)}>
          {children}
        </div>
      );
    }
    return <div style={style}>{children}</div>;
  }

  if (node.type === "text") {
    return <div style={textStyle(node, isFirst, parentLayout)}>{String(node.text ?? "")}</div>;
  }

  if (node.type === "separator") {
    return (
      <div
        style={{
          height: 1, background: (node.color as string) ?? "#e0e0e0",
          marginTop: isFirst ? undefined : px(node.margin), flexShrink: 0,
        }}
      />
    );
  }

  if (node.type === "button") {
    const action = node.action as { type?: string; label?: string; uri?: string; data?: string } | undefined;
    const label = action?.label ?? "";
    if (action?.type === "postback" && action.data) {
      return (
        <button type="button" style={buttonStyle(node, isFirst, parentLayout)} onClick={() => onPostback?.(action.data!)}>
          {label}
        </button>
      );
    }
    return (
      <a
        href={action?.uri ?? "#"} target="_blank" rel="noreferrer"
        style={{ ...buttonStyle(node, isFirst, parentLayout), textDecoration: "none" }}
      >
        {label}
      </a>
    );
  }

  return null;
}

/** 一則訊息：文字泡泡或一張 Flex bubble */
export function LineMessage({ message, onPostback }: { message: Node; onPostback?: (data: string) => void }) {
  if (message.type === "text") {
    return (
      <div className="max-w-[300px] whitespace-pre-wrap rounded-2xl rounded-tl-md bg-white px-3.5 py-2.5 text-[14px] leading-relaxed text-zinc-900 shadow-sm">
        {String(message.text ?? "")}
      </div>
    );
  }

  const bubble = message.contents as Node | undefined;
  if (!bubble || bubble.type !== "bubble") return null;

  const sections = ["header", "hero", "body", "footer"] as const;
  return (
    <div className="w-[300px] overflow-hidden rounded-xl shadow-sm">
      {sections.map((key) => {
        const section = bubble[key] as Node | undefined;
        if (!section) return null;
        return <FlexNode key={key} node={section} isFirst onPostback={onPostback} />;
      })}
    </div>
  );
}
