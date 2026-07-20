import { useEffect, useState, type ReactNode } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from 'react-native-paper';
import { colors } from '@/theme';

interface BottomSheetModalProps {
  visible: boolean;
  title: string;
  onDismiss: () => void;
  children: ReactNode;
  primaryLabel: string;
  onPrimary: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  secondaryLabel?: string;
  sheetStyle?: StyleProp<ViewStyle>;
}

export function BottomSheetModal({
  visible,
  title,
  onDismiss,
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel = 'Cancel',
  sheetStyle,
}: BottomSheetModalProps) {
  const insets = useSafeAreaInsets();
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (!visible) {
      setKeyboardHeight(0);
      return;
    }
    const showEvent =
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent =
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShow = Keyboard.addListener(showEvent, (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const onHide = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      onShow.remove();
      onHide.remove();
    };
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onDismiss} />
        <View
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 16),
              marginBottom: keyboardHeight,
              maxHeight: keyboardHeight > 0 ? '55%' : '88%',
            },
            sheetStyle,
          ]}
        >
          <Text variant="headlineSmall" style={styles.title}>
            {title}
          </Text>

          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {children}
          </ScrollView>

          <View style={styles.actions}>
            <Button
              mode="outlined"
              onPress={onDismiss}
              style={styles.actionBtn}
            >
              {secondaryLabel}
            </Button>
            <Button
              mode="contained"
              loading={primaryLoading}
              disabled={primaryDisabled || primaryLoading}
              onPress={onPrimary}
              style={styles.actionBtn}
            >
              {primaryLabel}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  title: {
    color: colors.primary,
    fontWeight: '800',
    marginBottom: 8,
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 10,
  },
});
