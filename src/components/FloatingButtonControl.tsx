import {Pressable, StyleSheet, Text, View} from 'react-native';

interface FloatingButtonControlProps {
  isOverlayVisible: boolean;
  onShow: () => void;
  onHide: () => void;
}

export function FloatingButtonControl({
  isOverlayVisible,
  onShow,
  onHide,
}: FloatingButtonControlProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kontrol FAB</Text>
      <Text style={styles.description}>
        FAB native adalah kontrol utama saat aplikasi manga sedang terbuka.
        Kamu bisa tampilkan ulang atau sembunyikan dari sini.
      </Text>
      <View style={styles.actions}>
        <Pressable onPress={onShow} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Tampilkan FAB</Text>
        </Pressable>
        <Pressable onPress={onHide} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Sembunyikan FAB</Text>
        </Pressable>
      </View>
      <Text style={styles.caption}>
        Status saat ini: {isOverlayVisible ? 'FAB aktif' : 'FAB tersembunyi'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 20,
    backgroundColor: '#121d22',
    borderWidth: 1,
    borderColor: '#203038',
    gap: 10,
  },
  title: {
    color: '#f7f4ea',
    fontSize: 18,
    fontWeight: '700',
  },
  description: {
    color: '#c5d1d3',
    fontSize: 14,
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#7ce6de',
  },
  primaryButtonText: {
    color: '#0f1720',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: '#24353d',
  },
  secondaryButtonText: {
    color: '#f7f4ea',
    fontSize: 14,
    fontWeight: '700',
  },
  caption: {
    color: '#8ea3aa',
    fontSize: 13,
  },
});
