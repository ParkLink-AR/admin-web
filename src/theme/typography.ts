import { TextStyle } from 'react-native';
import { colors } from './colors';

// Same type scale as mobile/src/theme/typography.ts, minus the
// font-scale-setting machinery this internal tool doesn't need.
export const typography: Record<'h1' | 'h2' | 'body' | 'caption', TextStyle> = {
  h1: { fontSize: 22, fontWeight: '700', color: colors.text, lineHeight: 28 },
  h2: { fontSize: 17, fontWeight: '600', color: colors.text, lineHeight: 22 },
  body: { fontSize: 15, fontWeight: '400', color: colors.text, lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', color: colors.textSecondary, lineHeight: 19 },
};
