import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Button,
  HelperText,
  Snackbar,
  Switch,
  Text,
} from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as printService from '@/services/printService';
import * as printerSettingsService from '@/services/printerSettingsService';
import { openAppPermissionSettings } from '@/services/bluetoothPermissions';
import { usePrinterStore } from '@/stores/printerStore';
import { colors } from '@/theme';
import type { PrinterDevice } from '@/services/printService';

export function PrinterScreen() {
  const isConnected = usePrinterStore((s) => s.isConnected);
  const deviceName = usePrinterStore((s) => s.deviceName);
  const deviceAddress = usePrinterStore((s) => s.deviceAddress);
  const autoPrint = usePrinterStore((s) => s.autoPrint);
  const paperWidth = usePrinterStore((s) => s.paperWidth);
  const connectDevice = usePrinterStore((s) => s.connectDevice);
  const disconnectDevice = usePrinterStore((s) => s.disconnectDevice);
  const hydrate = usePrinterStore((s) => s.hydrate);

  const [scanning, setScanning] = useState(false);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [devices, setDevices] = useState<PrinterDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [snack, setSnack] = useState<string | null>(null);
  const [savingOpts, setSavingOpts] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void hydrate();
    }, [hydrate])
  );

  useEffect(() => {
    return () => {
      void printService.stopPrinterScan();
    };
  }, []);

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const result = await printService.scanPrinters();
      const merged = [...result.paired, ...result.found].filter(
        (d, index, arr) =>
          arr.findIndex((x) => x.address === d.address) === index
      );
      setDevices(merged);
      if (merged.length === 0) {
        setSnack('No printers found. Pair one in system Bluetooth settings first.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const onConnect = async (device: PrinterDevice) => {
    setConnecting(device.address);
    setError(null);
    try {
      await connectDevice(device);
      setSnack(`Connected to ${device.name || 'printer'}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setConnecting(null);
    }
  };

  const onDisconnect = async () => {
    setError(null);
    try {
      await disconnectDevice();
      setSnack('Printer disconnected');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Disconnect failed');
    }
  };

  const setAutoPrint = async (value: boolean) => {
    setSavingOpts(true);
    try {
      await printerSettingsService.savePrinterOptions({
        paperWidth,
        autoPrint: value,
      });
      usePrinterStore.setState({ autoPrint: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save option');
    } finally {
      setSavingOpts(false);
    }
  };

  const setPaper = async (width: 58 | 80) => {
    setSavingOpts(true);
    try {
      await printerSettingsService.savePrinterOptions({
        paperWidth: width,
        autoPrint,
      });
      usePrinterStore.setState({ paperWidth: width });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save option');
    } finally {
      setSavingOpts(false);
    }
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.hero}>
        <Text variant="headlineSmall" style={styles.title}>
          Printer
        </Text>
        <Text style={styles.subtitle}>
          Connect a Bluetooth ESC/POS printer. Sales still complete if the
          printer is offline.
        </Text>
      </View>

      <View style={styles.statusCard}>
        <View
          style={[
            styles.statusIcon,
            isConnected ? styles.statusOn : styles.statusOff,
          ]}
        >
          <MaterialCommunityIcons
            name={isConnected ? 'printer-check' : 'printer-off'}
            size={28}
            color={isConnected ? colors.success : colors.printerDisconnected}
          />
        </View>
        <View style={styles.statusCopy}>
          <Text style={styles.statusTitle}>
            {isConnected ? 'Printer connected' : 'Printer disconnected'}
          </Text>
          <Text style={styles.statusBody}>
            {deviceName
              ? `${deviceName}${deviceAddress ? ` · ${deviceAddress.replace(/^(bt|ble|lan):/i, '')}` : ''}`
              : 'No saved printer'}
          </Text>
        </View>
      </View>

      {isConnected ? (
        <Button
          mode="outlined"
          onPress={() => void onDisconnect()}
          style={styles.btn}
          textColor={colors.error}
        >
          Disconnect
        </Button>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardHeading}>Options</Text>
        <View style={styles.switchRow}>
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>Auto-print on sale</Text>
            <Text style={styles.switchHint}>
              When off, checkout never prints (reprint still available).
            </Text>
          </View>
          <Switch
            value={autoPrint}
            onValueChange={(v) => void setAutoPrint(v)}
            color={colors.primary}
            disabled={savingOpts}
          />
        </View>
        <Text style={styles.paperLabel}>Paper width</Text>
        <View style={styles.paperRow}>
          {([58, 80] as const).map((w) => {
            const on = paperWidth === w;
            return (
              <Pressable
                key={w}
                onPress={() => void setPaper(w)}
                style={[styles.paperChip, on && styles.paperChipOn]}
              >
                <Text style={[styles.paperText, on && styles.paperTextOn]}>
                  {w}mm
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.scanHeader}>
          <Text style={styles.cardHeading}>Nearby / paired</Text>
          <Button
            mode="contained"
            onPress={() => void scan()}
            loading={scanning}
            disabled={scanning}
            compact
          >
            {scanning ? 'Scanning…' : 'Scan'}
          </Button>
        </View>
        <Text style={styles.hint}>
          Pair the printer in Android/iOS Bluetooth settings, then scan here.
          On Android, allow Nearby devices (and Location if prompted) when asked.
          Requires a development build (not Expo Go).
        </Text>

        {devices.length === 0 && !scanning ? (
          <Text style={styles.empty}>No devices listed yet.</Text>
        ) : (
          <FlatList
            data={devices}
            keyExtractor={(item) => item.address}
            scrollEnabled={false}
            renderItem={({ item }) => {
              const transport = printService.toTransportAddress(item);
              const selected =
                isConnected && deviceAddress === transport;
              return (
                <Pressable
                  onPress={() => void onConnect(item)}
                  disabled={!!connecting}
                  style={({ pressed }) => [
                    styles.deviceRow,
                    selected && styles.deviceRowOn,
                    pressed && styles.deviceRowPressed,
                  ]}
                >
                  <View style={styles.deviceIcon}>
                    {connecting === item.address ? (
                      <ActivityIndicator color={colors.primary} />
                    ) : (
                      <MaterialCommunityIcons
                        name="bluetooth"
                        size={20}
                        color={colors.primary}
                      />
                    )}
                  </View>
                  <View style={styles.deviceCopy}>
                    <Text style={styles.deviceName}>
                      {item.name || 'Unknown device'}
                    </Text>
                    <Text style={styles.deviceAddr}>{item.address}</Text>
                  </View>
                  {selected ? (
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={22}
                      color={colors.success}
                    />
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </View>

      {error ? (
        <View style={styles.errorBlock}>
          <HelperText type="error" visible style={styles.error}>
            {error}
          </HelperText>
          {error.toLowerCase().includes('settings') ? (
            <Button
              mode="outlined"
              onPress={() => void openAppPermissionSettings()}
              style={styles.settingsBtn}
            >
              Open app settings
            </Button>
          ) : null}
        </View>
      ) : null}

      <Snackbar visible={!!snack} onDismiss={() => setSnack(null)} duration={2800}>
        {snack}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  hero: { marginBottom: 14 },
  title: {
    color: colors.primary,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 6,
    color: colors.onSurface,
    opacity: 0.55,
    fontSize: 14,
    lineHeight: 20,
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
    marginBottom: 12,
  },
  statusIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusOn: { backgroundColor: colors.primaryContainer },
  statusOff: { backgroundColor: '#FCE8EC' },
  statusCopy: { flex: 1, minWidth: 0 },
  statusTitle: {
    fontWeight: '800',
    fontSize: 16,
    color: colors.primary,
  },
  statusBody: {
    marginTop: 4,
    fontSize: 13,
    color: colors.onSurface,
    opacity: 0.55,
  },
  btn: { borderRadius: 12, marginBottom: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outline,
  },
  cardHeading: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 15,
    marginBottom: 8,
  },
  scanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  hint: {
    color: colors.onSurface,
    opacity: 0.5,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  switchCopy: { flex: 1 },
  switchTitle: {
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 15,
  },
  switchHint: {
    marginTop: 2,
    fontSize: 12,
    color: colors.onSurface,
    opacity: 0.5,
  },
  paperLabel: {
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.onSurface,
    opacity: 0.45,
  },
  paperRow: { flexDirection: 'row', gap: 8 },
  paperChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
  },
  paperChipOn: { backgroundColor: colors.primary },
  paperText: { fontWeight: '700', color: colors.primary },
  paperTextOn: { color: colors.onPrimary },
  empty: {
    color: colors.onSurface,
    opacity: 0.45,
    fontSize: 14,
    paddingVertical: 8,
  },
  deviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
  },
  deviceRowOn: { backgroundColor: colors.primaryContainer, marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 12 },
  deviceRowPressed: { opacity: 0.85 },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceVariant,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deviceCopy: { flex: 1, minWidth: 0 },
  deviceName: {
    fontWeight: '700',
    color: colors.onSurface,
    fontSize: 15,
  },
  deviceAddr: {
    marginTop: 2,
    fontSize: 12,
    color: colors.onSurface,
    opacity: 0.45,
  },
  error: { marginTop: 4 },
  errorBlock: { marginTop: 4, gap: 8 },
  settingsBtn: { borderRadius: 12, alignSelf: 'flex-start' },
});
