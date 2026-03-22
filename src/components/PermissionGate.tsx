import {useState} from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';

interface PermissionGateProps {
  overlayGranted: boolean;
  screenCaptureGranted: boolean;
  onRequestOverlayPermission: () => Promise<void> | void;
  onRequestScreenCapturePermission: () => Promise<void>;
}

export function PermissionGate({
  overlayGranted,
  screenCaptureGranted,
  onRequestOverlayPermission,
  onRequestScreenCapturePermission,
}: PermissionGateProps) {
  const [busyStep, setBusyStep] = useState<'overlay' | 'capture' | null>(null);

  const handleOverlayPermission = async () => {
    setBusyStep('overlay');
    await onRequestOverlayPermission();
    setBusyStep(null);
  };

  const handleCapturePermission = async () => {
    setBusyStep('capture');
    try {
      await onRequestScreenCapturePermission();
    } finally {
      setBusyStep(null);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backgroundAccentTop} />
      <View style={styles.backgroundAccentBottom} />
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Persiapan Awal</Text>
        <Text style={styles.title}>Aktifkan dua izin sebelum overlay dipakai</Text>
        <Text style={styles.description}>
          YomeruApp butuh izin tampil di atas aplikasi lain dan izin screen
          capture agar pipeline OCR bisa berjalan.
        </Text>

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>01</Text>
            <Text style={styles.stepTitle}>Draw Over Other Apps</Text>
          </View>
          <Text style={styles.stepDescription}>
            Izin ini dipakai untuk menampilkan FAB mengambang di atas Mihon dan
            bubble hasil terjemahan.
          </Text>
          <Pressable
            disabled={overlayGranted || busyStep === 'overlay'}
            onPress={handleOverlayPermission}
            style={[
              styles.stepButton,
              overlayGranted ? styles.successButton : null,
            ]}>
            {busyStep === 'overlay' ? (
              <ActivityIndicator color="#0f1720" />
            ) : (
              <Text style={styles.stepButtonText}>
                {overlayGranted ? 'Sudah Aktif' : 'Buka Pengaturan'}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.stepCard}>
          <View style={styles.stepHeader}>
            <Text style={styles.stepNumber}>02</Text>
            <Text style={styles.stepTitle}>Screen Capture</Text>
          </View>
          <Text style={styles.stepDescription}>
            Token MediaProjection akan disimpan untuk sesi aktif, lalu dipakai
            setiap kali FAB ditekan.
          </Text>
          <Pressable
            disabled={!overlayGranted || screenCaptureGranted || busyStep === 'capture'}
            onPress={handleCapturePermission}
            style={[
              styles.stepButton,
              !overlayGranted ? styles.disabledButton : null,
              screenCaptureGranted ? styles.successButton : null,
            ]}>
            {busyStep === 'capture' ? (
              <ActivityIndicator color="#0f1720" />
            ) : (
              <Text style={styles.stepButtonText}>
                {screenCaptureGranted ? 'Sudah Aktif' : 'Izinkan'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'center',
    backgroundColor: '#0e171b',
  },
  backgroundAccentTop: {
    position: 'absolute',
    top: 80,
    right: -20,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#ff8a4c',
    opacity: 0.18,
  },
  backgroundAccentBottom: {
    position: 'absolute',
    bottom: 60,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#4fd1c5',
    opacity: 0.14,
  },
  panel: {
    borderRadius: 28,
    padding: 24,
    backgroundColor: '#162126',
    borderWidth: 1,
    borderColor: '#22343b',
    gap: 18,
  },
  eyebrow: {
    color: '#7ce6de',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: '#f7f4ea',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  description: {
    color: '#c5d1d3',
    fontSize: 15,
    lineHeight: 22,
  },
  stepCard: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    gap: 10,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#24353d',
    color: '#f7f4ea',
    textAlign: 'center',
    textAlignVertical: 'center',
    fontWeight: '800',
  },
  stepTitle: {
    color: '#f7f4ea',
    fontSize: 18,
    fontWeight: '700',
  },
  stepDescription: {
    color: '#c5d1d3',
    fontSize: 14,
    lineHeight: 21,
  },
  stepButton: {
    marginTop: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ff8a4c',
    minWidth: 148,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: '#7ce6de',
  },
  disabledButton: {
    backgroundColor: '#41535a',
  },
  stepButtonText: {
    color: '#0f1720',
    fontSize: 14,
    fontWeight: '800',
  },
});
