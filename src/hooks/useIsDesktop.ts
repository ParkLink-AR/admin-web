import { useWindowDimensions } from 'react-native';

// This tool is used by staff from a PC browser first and foremost (unlike
// mobile's phone-first design) -- 900px is roughly "a real browser window",
// below that we fall back to a stacked, phone-friendly layout so a narrow
// window or an actual phone browser doesn't hard-break.
export const DESKTOP_BREAKPOINT = 900;

export function useIsDesktop(): boolean {
  const { width } = useWindowDimensions();
  return width >= DESKTOP_BREAKPOINT;
}
