import {useEffect, useRef} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';

import type {TranslatedBubble} from '../types';

interface TranslationOverlayProps {
  bubbles: TranslatedBubble[];
}

interface BubbleCardProps {
  bubble: TranslatedBubble;
}

function BubbleCard({bubble}: BubbleCardProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          opacity,
          left: bubble.position.left,
          top: bubble.position.top,
          width: Math.max(bubble.position.width, 96),
          minHeight: Math.max(bubble.position.height, 42),
        },
      ]}>
      <Text
        adjustsFontSizeToFit
        minimumFontScale={0.72}
        numberOfLines={4}
        style={styles.bubbleText}>
        {bubble.translatedText}
      </Text>
    </Animated.View>
  );
}

export function TranslationOverlay({bubbles}: TranslationOverlayProps) {
  if (!bubbles.length) {
    return null;
  }

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {bubbles.map((bubble, index) => (
        <BubbleCard
          bubble={bubble}
          key={`${bubble.originalText}-${bubble.position.left}-${index}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    borderRadius: 8,
    padding: 6,
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowRadius: 8,
    elevation: 4,
  },
  bubbleText: {
    color: '#111827',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
});
