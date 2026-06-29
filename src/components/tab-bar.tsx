import * as React from "react"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

export type ChatTab = {
  id: string
  runId: string | null
}

export type FileTab = {
  id: string
  path: string
}

interface TabBarProps<T> {
  tabs: T[]
  activeTabId: string
  getTabTitle: (tab: T) => string
  getTabId: (tab: T) => string
  isProcessing?: (tab: T) => boolean
  onSwitchTab: (tabId: string) => void
  onCloseTab: (tabId: string) => void
  layout?: 'fill' | 'scroll'
  allowSingleTabClose?: boolean
}

export function TabBar<T>({
  tabs,
  activeTabId,
  getTabTitle,
  getTabId,
  onSwitchTab,
  onCloseTab,
  layout = 'fill',
  allowSingleTabClose = false,
}: TabBarProps<T>) {
  return (
    <div
      className={cn(
        'jobraker-recruiter-tabbar flex flex-1 self-center min-w-0',
        layout === 'scroll'
          ? 'overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
          : 'overflow-hidden'
      )}
    >
      {tabs.map((tab, index) => {
        const tabId = getTabId(tab)
        const isActive = tabId === activeTabId
        const title = getTabTitle(tab)

        return (
          <React.Fragment key={tabId}>
            {index > 0 && (
              <div className="jobraker-recruiter-tab-divider" aria-hidden="true" />
            )}
            <button
              type="button"
              onClick={() => onSwitchTab(tabId)}
              className={cn(
                'jobraker-recruiter-tab titlebar-no-drag group/tab relative flex items-center gap-1.5 px-4 text-xs transition-colors',
                layout === 'scroll' ? 'min-w-[140px] max-w-[240px]' : 'min-w-0 max-w-[220px]',
                isActive
                  ? 'is-active text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={layout === 'scroll' ? { flex: '0 0 auto' } : { flex: '1 1 0px' }}
            >
              <span className="truncate flex-1 text-left">{title}</span>
              {(allowSingleTabClose || tabs.length > 1) && (
                <span
                  role="button"
                  className="shrink-0 flex items-center justify-center rounded-full p-0.5 opacity-0 transition-all group-hover/tab:opacity-60 hover:bg-foreground/10 hover:opacity-100!"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCloseTab(tabId)
                  }}
                  aria-label="Close tab"
                >
                  <X className="size-3" />
                </span>
              )}
            </button>
            {/* Right edge divider after last tab to close off the section */}
            {index === tabs.length - 1 && (
              <div className="jobraker-recruiter-tab-divider" aria-hidden="true" />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}
