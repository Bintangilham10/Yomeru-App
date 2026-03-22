import {NativeModules} from 'react-native';

interface TranslationNativeModule {
  downloadModelIfNeeded(): Promise<boolean>;
  isModelDownloaded(): Promise<boolean>;
  translate(text: string): Promise<string>;
  translateBatch(textsJson: string): Promise<string>;
}

interface MyMemoryMatch {
  translation?: string;
}

interface MyMemoryResponse {
  responseData?: {
    translatedText?: string;
  };
  matches?: MyMemoryMatch[];
}

function getTranslationModule(): TranslationNativeModule | null {
  return (NativeModules.TranslationModule as TranslationNativeModule | undefined) ?? null;
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

async function fallbackTranslate(text: string): Promise<string> {
  const query = encodeURIComponent(text);
  const response = await fetch(
    `https://api.mymemory.translated.net/get?q=${query}&langpair=ja|id`,
  );

  if (!response.ok) {
    throw new Error(`Fallback API gagal dengan status ${response.status}`);
  }

  const payload = (await response.json()) as MyMemoryResponse;
  const translatedText =
    payload.responseData?.translatedText ?? payload.matches?.[0]?.translation;

  if (!translatedText) {
    throw new Error('Fallback API tidak mengembalikan hasil terjemahan');
  }

  return translatedText;
}

async function fallbackTranslateBatch(texts: string[]): Promise<string[]> {
  try {
    return await Promise.all(texts.map(text => fallbackTranslate(text)));
  } catch {
    throw new Error('Unduh model terjemahan dulu saat ada WiFi');
  }
}

export async function downloadTranslationModel(): Promise<boolean> {
  const module = getTranslationModule();

  if (!module) {
    return false;
  }

  return module.downloadModelIfNeeded();
}

export async function isTranslationModelReady(): Promise<boolean> {
  const module = getTranslationModule();

  if (!module) {
    return false;
  }

  return module.isModelDownloaded();
}

export async function translateText(text: string): Promise<string> {
  const module = getTranslationModule();

  if (!module) {
    return fallbackTranslate(text);
  }

  try {
    return await module.translate(text);
  } catch (error) {
    const message = getErrorMessage(error);

    if (message.includes('MODEL_NOT_READY')) {
      return fallbackTranslate(text);
    }

    throw new Error(message);
  }
}

export async function translateTexts(texts: string[]): Promise<string[]> {
  if (!texts.length) {
    return [];
  }

  const module = getTranslationModule();

  if (!module) {
    return fallbackTranslateBatch(texts);
  }

  try {
    const raw = await module.translateBatch(JSON.stringify(texts));
    const parsed = JSON.parse(raw) as unknown;

    if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
      throw new Error('Format hasil terjemahan batch tidak valid');
    }

    return parsed;
  } catch (error) {
    const message = getErrorMessage(error);

    if (message.includes('MODEL_NOT_READY')) {
      return fallbackTranslateBatch(texts);
    }

    throw new Error(message);
  }
}
