import {NativeModules} from 'react-native';

import {recognizeText} from './ocr';
import {translateTexts} from './translation';
import type {PipelineStatus, TranslatedBubble} from '../types';

interface ScreenCaptureNativeModule {
  requestCapturePermission(): Promise<string>;
  captureScreen(): Promise<string>;
  releaseProjection(): void;
}

interface RunTranslatePipelineOptions {
  onStatusChange?: (status: PipelineStatus) => void;
}

const MIN_CAPTURE_INTERVAL_MS = 1500;
const translationCache = new Map<string, string>();
let lastPipelineRunAt = 0;

function getScreenCaptureModule(): ScreenCaptureNativeModule | null {
  return (NativeModules.ScreenCaptureModule as ScreenCaptureNativeModule | undefined) ?? null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Terjadi kesalahan yang tidak diketahui';
}

export async function requestScreenCapturePermission(): Promise<string> {
  const module = getScreenCaptureModule();

  if (!module) {
    throw new Error('ScreenCaptureModule tidak tersedia di perangkat ini');
  }

  return module.requestCapturePermission();
}

export async function runTranslatePipeline(
  options: RunTranslatePipelineOptions = {},
): Promise<TranslatedBubble[]> {
  const now = Date.now();

  if (now - lastPipelineRunAt < MIN_CAPTURE_INTERVAL_MS) {
    throw new Error('Tunggu 1.5 detik sebelum mengambil layar lagi');
  }

  lastPipelineRunAt = now;

  const screenCaptureModule = getScreenCaptureModule();

  if (!screenCaptureModule) {
    throw new Error('ScreenCaptureModule tidak tersedia di perangkat ini');
  }

  options.onStatusChange?.('capturing');

  let imagePath: string;
  try {
    imagePath = await screenCaptureModule.captureScreen();
  } catch (error) {
    throw new Error(`Gagal mengambil tangkapan layar: ${getErrorMessage(error)}`);
  }

  options.onStatusChange?.('recognizing');

  const ocrResult = await recognizeText(imagePath).catch(error => {
    throw new Error(`Gagal menjalankan OCR: ${getErrorMessage(error)}`);
  });

  const blocks = ocrResult.blocks.filter(block => block.text.trim().length >= 2);

  if (!blocks.length) {
    return [];
  }

  options.onStatusChange?.('translating');

  const uniqueTexts = Array.from(new Set(blocks.map(block => block.text.trim())));
  const missingTexts = uniqueTexts.filter(text => !translationCache.has(text));

  if (missingTexts.length) {
    const translatedTexts = await translateTexts(missingTexts).catch(error => {
      throw new Error(`Gagal menerjemahkan teks: ${getErrorMessage(error)}`);
    });

    if (translatedTexts.length !== missingTexts.length) {
      throw new Error('Jumlah hasil terjemahan tidak cocok dengan input OCR');
    }

    missingTexts.forEach((text, index) => {
      translationCache.set(text, translatedTexts[index] ?? text);
    });
  }

  return blocks.map(block => ({
    originalText: block.text,
    translatedText: translationCache.get(block.text.trim()) ?? block.text,
    position: {
      left: block.left,
      top: block.top,
      width: block.width,
      height: block.height,
    },
  }));
}

export function clearTranslationCache() {
  translationCache.clear();
}

export function __resetPipelineStateForTests() {
  lastPipelineRunAt = 0;
  translationCache.clear();
}
