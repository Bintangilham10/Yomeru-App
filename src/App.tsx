import {useEffect, useRef, useState} from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {FloatingButtonControl} from './components/FloatingButtonControl';
import {PermissionGate} from './components/PermissionGate';
import {TranslationOverlay} from './components/TranslationOverlay';
import {useOverlay} from './hooks/useOverlay';
import {useTranslatePipeline} from './hooks/useTranslatePipeline';
import {requestScreenCapturePermission} from './services/pipeline';

function AppContent() {
  const [screenCaptureGranted, setScreenCaptureGranted] = useState(false);
  const [isFloatingButtonVisible, setIsFloatingButtonVisible] = useState(false);
  const hasAutoShownFloatingButton = useRef(false);
  const {
    status,
    bubbles,
    error,
    isModelReady,
    runPipeline,
    clearBubbles,
    downloadModel,
  } = useTranslatePipeline();
  const {
    overlayPermissionGranted,
    requestOverlayPermission,
    showFloatingButton,
    removeFloatingButton,
  } = useOverlay({
    bubbles,
    onCaptureRequested: async () => {
      clearBubbles();
      await runPipeline();
    },
  });

  useEffect(() => {
    const permissionsReady = overlayPermissionGranted && screenCaptureGranted;

    if (!permissionsReady) {
      hasAutoShownFloatingButton.current = false;
      setIsFloatingButtonVisible(false);
      return;
    }

    if (!hasAutoShownFloatingButton.current) {
      showFloatingButton();
      setIsFloatingButtonVisible(true);
      hasAutoShownFloatingButton.current = true;
    }
  }, [overlayPermissionGranted, screenCaptureGranted, showFloatingButton]);

  const handleRequestCapturePermission = async () => {
    await requestScreenCapturePermission();
    setScreenCaptureGranted(true);
  };

  const handleShowFloatingButton = () => {
    showFloatingButton();
    setIsFloatingButtonVisible(true);
  };

  const handleHideFloatingButton = () => {
    removeFloatingButton();
    setIsFloatingButtonVisible(false);
  };

  const permissionsReady = overlayPermissionGranted && screenCaptureGranted;

  if (!permissionsReady) {
    return (
      <PermissionGate
        overlayGranted={overlayPermissionGranted}
        screenCaptureGranted={screenCaptureGranted}
        onRequestOverlayPermission={requestOverlayPermission}
        onRequestScreenCapturePermission={handleRequestCapturePermission}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.backgroundOrbTop} />
      <View style={styles.backgroundOrbBottom} />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>YomeruApp</Text>
          <Text style={styles.title}>Overlay translator untuk manga Jepang</Text>
          <Text style={styles.description}>
            Ketuk FAB di atas aplikasi manga untuk mengambil layar, OCR, lalu
            menimpa bubble dengan terjemahan Indonesia.
          </Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Status pipeline</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusValue}>{status}</Text>
            </View>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        {!isModelReady ? (
          <View style={styles.secondaryCard}>
            <Text style={styles.cardTitle}>Model terjemahan belum siap</Text>
            <Text style={styles.cardText}>
              Unduh model JP ke ID via WiFi supaya pipeline bisa tetap jalan
              offline dan lebih cepat.
            </Text>
            <Pressable onPress={downloadModel} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>
                Download Model Terjemahan
              </Text>
            </Pressable>
          </View>
        ) : null}

        <FloatingButtonControl
          isOverlayVisible={isFloatingButtonVisible}
          onShow={handleShowFloatingButton}
          onHide={handleHideFloatingButton}
        />

        <View style={styles.secondaryCard}>
          <Text style={styles.cardTitle}>Cara pakai</Text>
          <Text style={styles.cardText}>
            1. Buka Mihon atau aplikasi manga lain.
          </Text>
          <Text style={styles.cardText}>
            2. Posisikan FAB di tepi layar yang nyaman.
          </Text>
          <Text style={styles.cardText}>
            3. Ketuk FAB setiap ingin menangkap halaman baru.
          </Text>
          <Text style={styles.cardText}>
            4. Ketuk lagi setelah ganti panel untuk memproses ulang.
          </Text>
        </View>
      </ScrollView>

      <TranslationOverlay bubbles={bubbles} />
    </SafeAreaView>
  );
}

export default function App() {
  return <AppContent />;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#10181a',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    gap: 18,
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#ff8a4c',
    opacity: 0.16,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: '#4fd1c5',
    opacity: 0.14,
  },
  heroCard: {
    borderRadius: 28,
    padding: 22,
    backgroundColor: '#162126',
    borderWidth: 1,
    borderColor: '#25353d',
    gap: 12,
  },
  secondaryCard: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  eyebrow: {
    color: '#7ce6de',
    fontSize: 12,
    letterSpacing: 2.2,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  title: {
    color: '#f7f4ea',
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
  },
  description: {
    color: '#c5d1d3',
    fontSize: 15,
    lineHeight: 22,
  },
  statusRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusLabel: {
    color: '#8ea3aa',
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#24343c',
  },
  statusValue: {
    color: '#f7f4ea',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  errorText: {
    color: '#ffb4a2',
    fontSize: 14,
    lineHeight: 20,
  },
  cardTitle: {
    color: '#f7f4ea',
    fontSize: 18,
    fontWeight: '700',
  },
  cardText: {
    color: '#c5d1d3',
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    alignSelf: 'flex-start',
    marginTop: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ff8a4c',
  },
  primaryButtonText: {
    color: '#1d1008',
    fontSize: 14,
    fontWeight: '800',
  },
});
