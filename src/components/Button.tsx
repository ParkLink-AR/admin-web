import { Pressable, Text, StyleSheet, ViewStyle, TextStyle, ActivityIndicator } from 'react-native';
import { colors } from '@/src/theme/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// Mirrors mobile/src/components/Button.tsx, plus a `variant`/`loading` prop
// this app's confirm flows (mark-paid, save commission) need.
export function Button({ title, onPress, disabled, loading, variant = 'primary', style, textStyle }: ButtonProps) {
  const variantStyle = variant === 'secondary' ? styles.secondary : variant === 'danger' ? styles.danger : styles.primary;
  const variantTextStyle = variant === 'secondary' ? styles.secondaryText : styles.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.button, variantStyle, (disabled || loading) && styles.disabled, style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' ? colors.teal : colors.white} />
      ) : (
        <Text style={[variantTextStyle, textStyle]}>{title}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.teal,
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '600',
  },
});
