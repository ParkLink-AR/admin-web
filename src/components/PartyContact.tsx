import { View, Text, Pressable, StyleSheet, Linking, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { colors } from '@/src/theme/colors';
import { AdminUserDetail } from '@/src/types';

type PressableState = { pressed: boolean; hovered?: boolean };
const CURSOR_POINTER = { cursor: 'pointer' } as unknown as ViewStyle;

export function displayName(u: AdminUserDetail) {
  const name = [u.firstName, u.lastName].filter(Boolean).join(' ');
  return name || u.email;
}

/** Phone digits for a WhatsApp link (wa.me wants the number with country code, no "+"). */
function whatsappNumber(phone: string) {
  return phone.replace(/[^0-9]/g, '');
}

/**
 * One side of a booking (driver or owner) with what staff need to reach them: their
 * name, linking to their full account page, plus email, phone and WhatsApp, each one
 * click away. `compact` keeps it to a couple of lines for list rows.
 */
export function PartyContact({
  label,
  user,
  fallbackId,
  compact = false,
}: {
  label: string;
  user: AdminUserDetail | null;
  fallbackId?: string;
  compact?: boolean;
}) {
  if (!user) {
    return (
      <View style={styles.block}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.hint}>No se pudo cargar{fallbackId ? ` (ID: ${fallbackId})` : ''}.</Text>
      </View>
    );
  }

  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        onPress={() => router.push(`/(admin)/users/${user.id}`)}
        style={({ hovered }: PressableState) => [styles.nameRow, hovered && styles.hovered, CURSOR_POINTER]}
        accessibilityRole="link"
      >
        <Ionicons name="person-circle-outline" size={18} color={colors.teal} />
        <Text style={styles.name} numberOfLines={1}>{displayName(user)}</Text>
        <Text style={styles.viewAccount}>Ver cuenta</Text>
        <Ionicons name="chevron-forward" size={14} color={colors.teal} />
      </Pressable>
      <View style={compact ? styles.contactsInline : styles.contacts}>
        <ContactLink icon="mail-outline" text={user.email} url={`mailto:${user.email}`} />
        {user.phone ? (
          <>
            <ContactLink icon="call-outline" text={user.phone} url={`tel:${user.phone}`} />
            <ContactLink icon="logo-whatsapp" text="WhatsApp" url={`https://wa.me/${whatsappNumber(user.phone)}`} />
          </>
        ) : (
          <Text style={styles.hint}>Sin teléfono</Text>
        )}
      </View>
    </View>
  );
}

function ContactLink({ icon, text, url }: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; url: string }) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      style={({ hovered }: PressableState) => [styles.contact, hovered && styles.hovered, CURSOR_POINTER]}
      accessibilityRole="link"
    >
      <Ionicons name={icon} size={14} color={colors.textSecondary} />
      <Text style={styles.contactText} numberOfLines={1}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: 4, flex: 1, minWidth: 220 },
  label: { fontSize: 12, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 3, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: 6 },
  name: { fontSize: 14, fontWeight: '700', color: colors.text, flexShrink: 1 },
  viewAccount: { fontSize: 12, fontWeight: '600', color: colors.teal, marginLeft: 'auto' },
  contacts: { gap: 2 },
  contactsInline: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12, rowGap: 2 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2, paddingHorizontal: 4, marginHorizontal: -4, borderRadius: 6 },
  contactText: { fontSize: 13, color: colors.text },
  hovered: { backgroundColor: colors.background },
  hint: { fontSize: 13, color: colors.textSecondary },
});
