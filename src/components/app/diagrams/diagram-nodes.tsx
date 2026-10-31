"use client";

/**
 * نمادهای گره سفارشی React Flow — هم‌شکل با رندر خالص SVG (svg.ts) تا ویرایشگر و خروجی یکسان باشند.
 * پیکان اتصال همیشه در مقصد است (جهت معنایی مستقل از RTL — B6/B13).
 */

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { symbolLabelFa, type DiagramKind, type DiagramSymbol } from "@/shared/diagrams/types";
import { formatSeconds } from "@/shared/diagrams/svg";

/** رنگ نماد — همان پالت خروجی SVG */
export function symbolColor(symbol: DiagramSymbol): string {
  switch (symbol) {
    case "operation":
      return "#0f766e";
    case "inspection":
      return "#b45309";
    case "transport":
      return "#9a3412";
    case "delay":
      return "#a16207";
    case "storage":
      return "#57534e";
    case "componentEntry":
      return "#15803d";
    case "assemblyPoint":
      return "#52525b";
    default:
      return "#44403c";
  }
}

function SymbolGlyph({ symbol, size = 34 }: { symbol: DiagramSymbol; size?: number }) {
  const c = symbolColor(symbol);
  const stroke = { stroke: c, strokeWidth: 2, fill: "none" } as const;
  const r = size / 2;
  switch (symbol) {
    case "operation":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={r} cy={r} r={r - 1} {...stroke} fill="#f0fdfa" />
        </svg>
      );
    case "inspection":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <rect x={1} y={1} width={size - 2} height={size - 2} rx={2} {...stroke} fill="#fffbeb" />
        </svg>
      );
    case "transport":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <path
            d={`M 4 ${size * 0.2} L 4 ${size * 0.8} L ${size - 4} ${size * 0.65} L ${size - 4} ${size * 0.85}`}
            {...stroke}
            fill="#fef2f2"
            strokeLinejoin="round"
          />
          <path d={`M ${size - 4} ${size * 0.85} l ${-size * 0.28} ${-size * 0.22} l ${size * 0.28} ${-size * 0.08}`} {...stroke} fill="none" />
        </svg>
      );
    case "delay":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <path
            d={`M 1 3 h ${size * 0.45} a ${(size - 6) / 2} ${(size - 6) / 2} 0 0 1 0 ${size - 6} h ${-size * 0.45} z`}
            {...stroke}
            fill="#fefce8"
          />
          <text x={size * 0.22} y={size * 0.66} fontSize={size * 0.5} fontWeight={700} fill={c} fontFamily="inherit">
            D
          </text>
        </svg>
      );
    case "storage":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <path d={`M 2 6 L ${size - 2} 6 L ${size / 2} ${size - 3} Z`} {...stroke} fill="#f5f5f4" strokeLinejoin="round" />
        </svg>
      );
    case "componentEntry":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <path
            d={`M 2 8 L ${size - 2} 2 L ${size - 2} ${size - 2} L 2 ${size - 8} Z`}
            {...stroke}
            fill="#f0fdf4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "assemblyPoint":
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <path d={`M 2 5 L ${size - 2} 5 L ${size / 2} ${size - 2} Z`} {...stroke} fill="#fafaf9" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
          <circle cx={r} cy={r} r={r - 1} {...stroke} />
        </svg>
      );
  }
}

export interface DiagramStepNodeData extends Record<string, unknown> {
  node: {
    id: string;
    stepNo: number | null;
    symbol: DiagramSymbol;
    title: string;
    timeSec?: number | null;
    distanceM?: number | null;
    quantity?: number | null;
    note?: string | null;
    activityStableKey?: string | null;
    sourceRef?: string | null;
  };
  kind: DiagramKind;
  distanceUnit?: string;
  hasError?: boolean;
  hasWarning?: boolean;
}

function StepNodeInner({ data, selected }: NodeProps) {
  const d = data as DiagramStepNodeData;
  const { node, kind, distanceUnit } = d;
  const meta: string[] = [];
  if (node.timeSec !== undefined && node.timeSec !== null) meta.push(formatSeconds(node.timeSec));
  if (kind === "fpc" && node.distanceM !== undefined && node.distanceM !== null) meta.push(`${node.distanceM} ${distanceUnit ?? "m"}`);
  if (kind === "opc" && node.quantity !== undefined && node.quantity !== null) meta.push(`×${node.quantity}`);
  const c = symbolColor(node.symbol);

  return (
    <div
      className={cn(
        "w-[190px] rounded-xl border-2 bg-white p-2 shadow-sm transition-shadow",
        selected ? "border-primary shadow-md" : "border-stone-200",
        d.hasError && "border-red-400",
        !d.hasError && d.hasWarning && "border-amber-400",
      )}
      style={{ direction: "rtl" }}
    >
      {/* هندل‌های اتصال: بالا/پایین (جریان عمودی) — z بالاتر از محتوا تا کلیک روی نماد، drag اتصال را نپوشاند */}
      <Handle type="target" position={Position.Top} style={{ background: c, zIndex: 20 }} aria-label="ورودی اتصال" />
      <Handle type="source" position={Position.Bottom} style={{ background: c, zIndex: 20 }} aria-label="خروجی اتصال" />

      <div className="flex items-center gap-2">
        <div className="relative shrink-0" aria-hidden>
          <SymbolGlyph symbol={node.symbol} size={34} />
        </div>
        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center justify-end gap-1.5">
            {node.activityStableKey ? (
              <span className="inline-block size-2 shrink-0 rounded-full bg-teal-600" title={`مرتبط با فعالیت: ${node.activityStableKey}`} />
            ) : null}
            {node.stepNo !== null && node.stepNo !== undefined ? (
              <span
                className="flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ background: c }}
              >
                {node.stepNo}
              </span>
            ) : null}
            <span className="truncate text-[11px] font-medium text-stone-500">{symbolLabelFa(kind, node.symbol)}</span>
          </div>
          <p className="line-clamp-2 text-xs font-semibold leading-4 text-stone-900">{node.title}</p>
        </div>
      </div>
      {meta.length > 0 ? (
        <div className="mt-1 flex flex-wrap justify-end gap-1" dir="rtl">
          {meta.map((m) => (
            <span key={m} className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] text-stone-600">
              {m}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const DiagramStepNode = memo(StepNodeInner);
