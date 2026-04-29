import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../theme';

type Props = {
  title: string;
  hint: string;
};

/**
 * Shared skeleton layout for placeholder screens until real ones land.
 * Using this keeps the placeholders in sync (spacing/typography/dark mode)
 * and makes it trivial to swap a screen in by dropping this component.
 */
export default function PlaceholderScreen({ title, hint }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg, padding: theme.spacing.lg }]}>
      <Text
        style={[
          theme.typography.heading,
          { color: theme.colors.text, marginBottom: theme.spacing.sm },
        ]}
      >
        {title}
      </Text>
      <Text style={[theme.typography.caption, { color: theme.colors.textMuted, textAlign: 'center' }]}>
        {hint}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
