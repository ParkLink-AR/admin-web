import { useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { PayoutDetailPanel } from '@/src/components/PayoutDetailPanel';
import { colors } from '@/src/theme/colors';

// Full-page route for the payout detail -- used on narrow windows/phones
// (where app/(admin)/payouts/index.tsx navigates here instead of showing an
// inline pane) and for direct links. On a wide desktop window,
// payouts/index.tsx renders the same PayoutDetailPanel inline instead, as
// the right-hand side of a master-detail layout.
export default function PayoutDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <PageHeader title="Detalle de pago" showBack />
      </View>
      <PayoutDetailPanel payoutId={id} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 16 },
});
