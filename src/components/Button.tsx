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

// react-native-web's Pressable passes a real `hovered` flag into the style
// callback at runtime (mouse-only, never fires on touch) -- RN core's
// PressableStateCallbackType doesn't declare it, so this widens the param
// type locally. `{ pressed: boolean }` still satisfies the narrower type
// Pressable's own `style` prop expects, so this remains assignable to it.
type PressableState = { pressed: boolean; hovered?: boolean };

// Mirrors mobile/src/components/Button.tsx, plus a `variant`/`loading` prop
// this app's confirm flows (mark-paid, save commission) need, and hover
// feedback + a pointer cursor for the desktop-web target of this app.
export function Button({ title, onPress, disabled, loading, variant = 'primary', style, textStyle }: ButtonProps) {
  const variantStyle = variant === 'secondary' ? styles.secondary : variant === 'danger' ? styles.danger : styles.primary;
  const variantHoverStyle = variant === 'secondary' ? styles.secondaryHovered : variant === 'danger' ? styles.dangerHovered : styles.primaryHovered;
  const variantTextStyle = variant === 'secondary' ? styles.secondaryText : styles.text;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ hovered }: PressableState) => [
        styles.button,
        variantStyle,
        hovered && !isDisabled && variantHoverStyle,
        isDisabled && styles.disabled,
        // `cursor` is a react-native-web-only style property with no RN
        // ViewStyle equivalent -- passed through verbatim to the DOM node.
        { cursor: isDisabled ? 'default' : 'pointer' } as unknown as ViewStyle,
        style,
      ]}
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
  primaryHovered: {
    backgroundColor: '#137274',
  },
  secondary: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryHovered: {
    backgroundColor: colors.background,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  dangerHovered: {
    backgroundColor: '#B91C1C',
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
