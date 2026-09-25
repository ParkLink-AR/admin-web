import { SafeAreaView, Edge } from 'react-native-safe-area-context';
import { ViewStyle } from 'react-native';

interface ScreenProps {
  children: React.ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
}

// Mirrors mobile/src/components/Screen.tsx.
export function Screen({ children, style, edges }: ScreenProps) {
  const resolvedEdges: Edge[] = edges ?? ['top', 'left', 'right'];
  return (
    <SafeAreaView style={[{ flex: 1 }, style]} edges={resolvedEdges}>
      {children}
    </SafeAreaView>
  );
}
