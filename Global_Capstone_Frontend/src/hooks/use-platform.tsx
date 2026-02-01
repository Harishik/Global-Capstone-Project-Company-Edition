import { useState, useEffect } from "react";

/**
 * Hook to detect the user's platform (macOS, Windows, Linux, etc.)
 */
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState<boolean>(false);

  useEffect(() => {
    // Check for macOS using multiple methods for better compatibility
    const platform = navigator.platform?.toLowerCase() ?? "";
    const userAgent = navigator.userAgent?.toLowerCase() ?? "";
    
    const isMacOS = 
      platform.includes("mac") || 
      userAgent.includes("macintosh") ||
      userAgent.includes("mac os x");
    
    setIsMac(isMacOS);
  }, []);

  return isMac;
}

/**
 * Returns the appropriate modifier key symbol based on platform
 * - macOS: ⌘ (Command key)
 * - Windows/Linux: Ctrl
 */
export function useModifierKey(): string {
  const isMac = useIsMac();
  return isMac ? "⌘" : "Ctrl";
}

/**
 * Returns platform-specific keyboard shortcut display
 * @param key - The key to combine with the modifier (e.g., "K", "B")
 */
export function useKeyboardShortcut(key: string): string {
  const modifier = useModifierKey();
  return `${modifier}+${key}`;
}
