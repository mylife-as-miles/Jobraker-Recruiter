"use client";

import { cn } from "@/lib/utils";
import { ChevronDownIcon, CircleCheck, LoaderIcon, XCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { ToolState } from "@/lib/chat-conversation";

/** Shared Jobraker-style row chrome for tool / agent activity lines. */
export const AGENT_WORK_ROW_CLASS =
  "flex w-full max-w-full items-center gap-2 rounded-lg border border-brand/20 bg-brand/[0.06] px-3 py-2 text-[13px] leading-5 text-muted-foreground transition-colors";

export const getAgentWorkLeadIcon = (state: ToolState): ReactNode => {
  if (state === "output-available") {
    return <CircleCheck className="size-3.5 shrink-0 text-brand" />;
  }
  if (state === "output-error") {
    return <XCircleIcon className="size-3.5 shrink-0 text-red-400" />;
  }
  return <LoaderIcon className="size-3.5 shrink-0 animate-spin text-brand" />;
};

export type AgentWorkRowProps = {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  expandable?: boolean;
  title?: string;
};

export function AgentWorkRow({
  icon,
  children,
  className,
  onClick,
  expandable,
  title,
}: AgentWorkRowProps) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title}
      className={cn(
        AGENT_WORK_ROW_CLASS,
        "group/agent-work-row",
        onClick && "cursor-pointer text-left hover:bg-brand/[0.09]",
        className,
      )}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate text-left text-foreground/85">{children}</span>
      {expandable && (
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-muted-foreground transition-transform",
            "group-data-[state=open]/agent-work-row:rotate-180",
          )}
        />
      )}
    </Tag>
  );
}
