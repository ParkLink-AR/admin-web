import { router, useLocalSearchParams } from 'expo-router';
import { View, StyleSheet } from 'react-native';
import { Screen } from '@/src/components/Screen';
import { PageHeader } from '@/src/components/PageHeader';
import { SettlementDetailPanel } from '@/src/components/SettlementDetailPanel';
import { colors } from '@/src/theme/colors';

// Full-page route for the settlement detail -- used on narrow windows/phones (where
// app/(admin)/settlements/index.tsx navigates here instead of showing an inline pane),
// for direct links, and as the hand-off target right after drafting a settlement from
// payouts/owner/[id].tsx. On a wide desktop window, settlements/index.tsx renders the
// same SettlementDetailPanel inline instead, as the right-hand side of a master-detail
// layout.
export default function SettlementDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;

  return (
    <Screen style={styles.screen} edges={['left', 'right']}>
      <View style={styles.header}>
        <PageHeader title="Detalle de liquidación" showBack />
      </View>
      <SettlementDetailPanel settlementId={id} onCancelled={() => router.back()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 16 },
});
