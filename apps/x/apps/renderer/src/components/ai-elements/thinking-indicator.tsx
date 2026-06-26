"use client";

import { ChevronDownIcon } from "lucide-react";
import { ChatAssistantRow } from "@/components/chat-assistant-row";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { cn } from "@/lib/utils";

type ThinkingIndicatorProps = {
  label?: string;
  onScrollToBottom?: () => void;
  className?: string;
};

/** Jobraker-style thinking row: divider + bot avatar + shimmer label. */
export function ThinkingIndicator({
  label = "Thinking...",
  onScrollToBottom,
  className,
}: ThinkingIndicatorProps) {
  return (
    <ChatAssistantRow className={className}>
      <div className="flex w-full flex-col gap-2">
        <div className="relative flex items-center py-1">
          <div className="h-px flex-1 bg-border/40" />
          <button
            type="button"
            onClick={onScrollToBottom}
            className={cn(
              "mx-2 flex size-7 shrink-0 items-center justify-center rounded-full",
              "border border-border/50 bg-background/80 text-muted-foreground",
              "transition hover:border-brand/30 hover:text-brand",
            )}
            aria-label="Scroll to latest"
          >
            <ChevronDownIcon className="size-4" />
          </button>
          <div className="h-px flex-1 bg-border/40" />
        </div>
        <Message from="assistant">
          <MessageContent className="border-0 bg-transparent px-0 py-0 shadow-none">
            <Shimmer duration={1.2} className="text-sm">
              {label}
            </Shimmer>
          </MessageContent>
        </Message>
      </div>
    </ChatAssistantRow>
  );
}
