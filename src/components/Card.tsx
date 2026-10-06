import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '@/src/theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

// Bordered surface box for grouping related info -- mirrors
// mobile/src/components/Card.tsx (radius 14, 1px border, no shadow).
export function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
});
