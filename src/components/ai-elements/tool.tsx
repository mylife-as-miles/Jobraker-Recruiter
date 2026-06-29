"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { ToolUIPart } from "ai";
import { type ComponentProps, type ReactNode, isValidElement, useState } from "react";
import type { ToolCall, ToolGroup as ToolGroupType } from "@/lib/chat-conversation";
import {
  getToolActionsSummary,
  getToolDisplayName,
  getToolGroupSummary,
  toToolState,
} from "@/lib/chat-conversation";
import { AgentWorkRow, getAgentWorkLeadIcon } from "./agent-work-row";

const formatToolValue = (value: unknown) => {
  if (typeof value === "string") return value;
  try {
    const json = JSON.stringify(value ?? null, null, 2);
    return json ?? "";
  } catch {
    return String(value);
  }
};

const ToolCode = ({
  code,
  className,
}: {
  code: string;
  className?: string;
}) => (
  <pre
    className={cn(
      "whitespace-pre-wrap break-all font-mono text-xs",
      className
    )}
  >
    {code || "(empty)"}
  </pre>
);

export type ToolProps = ComponentProps<typeof Collapsible>;

export const Tool = ({ className, ...props }: ToolProps) => (
  <Collapsible
    className={cn("not-prose mb-2 w-full", className)}
    {...props}
  />
);

export type ToolHeaderProps = {
  title?: string;
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
  className?: string;
  hideLeadIcon?: boolean;
};

export const ToolHeader = ({
  className,
  title,
  type,
  state,
  hideLeadIcon,
  ...props
}: ToolHeaderProps) => {
  const displayTitle = title ?? type.split("-").slice(1).join("-");

  return (
    <CollapsibleTrigger asChild {...props}>
      <AgentWorkRow
        icon={!hideLeadIcon ? getAgentWorkLeadIcon(state) : undefined}
        expandable
        title={displayTitle}
        className={className}
      >
        {displayTitle}
      </AgentWorkRow>
    </CollapsibleTrigger>
  );
};

export type ToolContentProps = ComponentProps<typeof CollapsibleContent>;

export const ToolContent = ({ className, ...props }: ToolContentProps) => (
  <CollapsibleContent
    className={cn(
      "overflow-hidden outline-none data-[state=open]:animate-[collapsible-down_0.09s_ease-out] data-[state=closed]:animate-[collapsible-up_0.08s_ease-in]",
      className
    )}
    {...props}
  />
);

export type ToolTabbedContentProps = {
  input: ToolUIPart["input"];
  output: ToolUIPart["output"];
  errorText?: ToolUIPart["errorText"];
};

export const ToolTabbedContent = ({
  input,
  output,
  errorText,
}: ToolTabbedContentProps) => {
  const [activeTab, setActiveTab] = useState<"parameters" | "result">("parameters");
  const hasOutput = output != null || !!errorText;

  let OutputNode: ReactNode = null;
  if (errorText) {
    OutputNode = <ToolCode code={errorText} className="text-destructive" />;
  } else if (output != null) {
    if (typeof output === "object" && !isValidElement(output)) {
      OutputNode = <ToolCode code={formatToolValue(output)} />;
    } else if (typeof output === "string") {
      OutputNode = <ToolCode code={output} />;
    } else {
      OutputNode = <div>{output as ReactNode}</div>;
    }
  }

  return (
    <div className="mt-1 rounded-lg border border-border/40 bg-background/40">
      <div className="flex border-b border-border/40">
        <button
          type="button"
          className={cn(
            "border-b-2 px-3 py-1.5 text-[11px] font-medium transition-colors",
            activeTab === "parameters"
              ? "border-brand text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("parameters")}
        >
          Parameters
        </button>
        <button
          type="button"
          className={cn(
            "border-b-2 px-3 py-1.5 text-[11px] font-medium transition-colors",
            activeTab === "result"
              ? "border-brand text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setActiveTab("result")}
        >
          Result
        </button>
      </div>
      <div className="p-2.5">
        {activeTab === "parameters" && (
          <div className="max-h-56 overflow-auto rounded-md border border-border/30 bg-muted/30 p-2">
            <ToolCode code={formatToolValue(input ?? {})} />
          </div>
        )}
        {activeTab === "result" && (
          <div
            className={cn(
              "max-h-56 overflow-auto rounded-md border p-2",
              errorText ? "border-destructive/30 bg-destructive/10" : "border-border/30 bg-muted/30"
            )}
          >
            {hasOutput ? (
              <div className={cn(errorText && "text-destructive")}>{OutputNode}</div>
            ) : (
              <span className="text-xs text-muted-foreground">(pending...)</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export type ToolGroupProps = {
  group: ToolGroupType;
  isToolOpen: (toolId: string) => boolean;
  onToolOpenChange: (toolId: string, open: boolean) => void;
};

const getGroupState = (tools: ToolCall[]): ToolUIPart["state"] => {
  if (tools.some((t) => t.status === "error")) return "output-error";
  if (tools.some((t) => t.status === "running")) return "input-available";
  if (tools.some((t) => t.status === "pending")) return "input-streaming";
  return "output-available";
};

export const ToolGroupComponent = ({ group, isToolOpen, onToolOpenChange }: ToolGroupProps) => {
  const [open, setOpen] = useState(false);
  const state = getGroupState(group.items);
  const isCompleted = state === "output-available" || state === "output-error";
  const runningTool = group.items.find((t) => t.status === "running" || t.status === "pending");
  const currentTool = runningTool ?? group.items[group.items.length - 1];
  const toolCount = group.items.length;
  const ranLabel = `Ran ${toolCount} tool${toolCount !== 1 ? "s" : ""}`;
  const actions = isCompleted ? getToolActionsSummary(group.items) : "";
  const summaryText = isCompleted
    ? `${ranLabel} · ${actions}`
    : currentTool
      ? getToolDisplayName(currentTool)
      : getToolGroupSummary(group.items);
  const summaryNode: ReactNode = isCompleted ? (
    <>
      <span className="font-medium text-foreground/90">{ranLabel}</span>
      <span className="font-normal text-muted-foreground">{` · ${actions}`}</span>
    </>
  ) : (
    summaryText
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="not-prose mb-2 w-full">
      <CollapsibleTrigger asChild>
        <AgentWorkRow
          icon={getAgentWorkLeadIcon(state)}
          expandable
          title={summaryText}
        >
          <span className="block truncate">{summaryNode}</span>
        </AgentWorkRow>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 space-y-1 overflow-hidden pl-1 data-[state=open]:animate-[collapsible-down_0.09s_ease-out] data-[state=closed]:animate-[collapsible-up_0.08s_ease-in]">
        {group.items.map((tool) => {
          const toolState = toToolState(tool.status);
          const isToolExpanded = isToolOpen(tool.id);
          return (
            <Tool
              key={tool.id}
              open={isToolExpanded}
              onOpenChange={(o) => onToolOpenChange(tool.id, o)}
              className="mb-0"
            >
              <ToolHeader
                title={getToolDisplayName(tool)}
                type={`tool-${tool.name}`}
                state={toolState}
                hideLeadIcon
              />
              <ToolContent>
                <ToolTabbedContent
                  input={tool.input as ToolUIPart["input"]}
                  output={tool.result as ToolUIPart["output"]}
                  errorText={tool.status === "error" ? "Tool error" : undefined}
                />
              </ToolContent>
            </Tool>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

/** Compact status-only row (no expand) for permission-adjacent tool feedback. */
export function ToolStatusRow({
  title,
  state,
  className,
}: {
  title: string;
  state: ToolUIPart["state"];
  className?: string;
}) {
  return (
    <AgentWorkRow icon={getAgentWorkLeadIcon(state)} className={className} title={title}>
      {title}
    </AgentWorkRow>
  );
}
