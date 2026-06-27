/** Native Windows title-bar overlay reserves space for min/max/close. */
export const WINDOWS_TITLEBAR_OVERLAY_INSET_PX = 138

export function isMacPlatform(): boolean {
  if (typeof window !== 'undefined' && window.electronPlatform) {
    return window.electronPlatform === 'darwin'
  }
  return typeof navigator !== 'undefined' && navigator.platform.toLowerCase().includes('mac')
}

export function usesNativeTitleBarOverlay(): boolean {
  return typeof window !== 'undefined' && window.electronPlatform === 'win32'
}

export function titlebarRightInsetPx(): number {
  if (isMacPlatform()) return 12
  if (usesNativeTitleBarOverlay()) return WINDOWS_TITLEBAR_OVERLAY_INSET_PX
  return 12
}
