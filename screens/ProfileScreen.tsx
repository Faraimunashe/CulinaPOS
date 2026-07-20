import { View, StyleSheet } from 'react-native';
import { Text, List, Divider } from 'react-native-paper';
import { useAuthStore } from '@/stores/authStore';
import { colors } from '@/theme';

export function ProfileScreen() {
  const user = useAuthStore((s) => s.user);

  if (!user) {
    return null;
  }

  return (
    <View style={styles.root}>
      <Text variant="headlineSmall" style={styles.heading}>
        Profile
      </Text>
      <List.Section style={styles.section}>
        <List.Item
          title="Full name"
          description={user.full_name}
          left={(props) => <List.Icon {...props} icon="account" />}
        />
        <Divider />
        <List.Item
          title="Username"
          description={user.username}
          left={(props) => <List.Icon {...props} icon="at" />}
        />
        <Divider />
        <List.Item
          title="Role"
          description={user.role === 'ADMIN' ? 'Admin' : 'Cashier'}
          left={(props) => <List.Icon {...props} icon="shield-account" />}
        />
        <Divider />
        <List.Item
          title="Status"
          description={user.status}
          left={(props) => <List.Icon {...props} icon="check-circle" />}
        />
      </List.Section>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 20,
  },
  heading: {
    color: colors.primary,
    fontWeight: '700',
    marginBottom: 8,
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
});
