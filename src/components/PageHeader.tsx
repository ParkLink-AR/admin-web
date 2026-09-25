import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/src/theme/colors';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
}

// Replaces the native Stack header title/back-button this app used to get
// for free -- the (admin) shell now renders a persistent sidebar instead of
// a Stack, so each screen owns its own heading and (optional) back link.
export function PageHeader({ title, subtitle, showBack }: PageHeaderProps) {
  return (
    <View style={styles.container}>
      {showBack ? (
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
          <Ionicons name="arrow-back" size={16} color={colors.teal} />
          <Text style={styles.backText}>Volver</Text>
        </Pressable>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 10, alignSelf: 'flex-start' },
  backText: { color: colors.teal, fontSize: 13, fontWeight: '600' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
});
