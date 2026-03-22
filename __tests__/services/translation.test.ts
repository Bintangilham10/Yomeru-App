/**
 * @format
 */

import {NativeModules} from 'react-native';

import {
  downloadTranslationModel,
  isTranslationModelReady,
  translateText,
  translateTexts,
} from '../../src/services/translation';

describe('translation service', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    delete NativeModules.TranslationModule;
    globalThis.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('uses native batch translation when model is ready', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn().mockResolvedValue(true),
      translate: jest.fn(),
      translateBatch: jest.fn().mockResolvedValue(JSON.stringify(['Halo'])),
    };

    await expect(translateTexts(['cat'])).resolves.toEqual(['Halo']);
  });

  it('downloads the native translation model when the module exists', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn().mockResolvedValue(true),
      isModelDownloaded: jest.fn(),
      translate: jest.fn(),
      translateBatch: jest.fn(),
    };

    await expect(downloadTranslationModel()).resolves.toBe(true);
  });

  it('returns false when download is requested without the native module', async () => {
    await expect(downloadTranslationModel()).resolves.toBe(false);
  });

  it('falls back to MyMemory when native model is not ready', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn().mockResolvedValue(false),
      translate: jest.fn(),
      translateBatch: jest.fn().mockRejectedValue(new Error('MODEL_NOT_READY')),
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: {
          translatedText: 'Kucing',
        },
      }),
    }) as unknown as typeof fetch;

    await expect(translateTexts(['cat'])).resolves.toEqual(['Kucing']);
  });

  it('uses native single-text translation when available', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn().mockResolvedValue(true),
      translate: jest.fn().mockResolvedValue('Halo langsung'),
      translateBatch: jest.fn(),
    };

    await expect(translateText('neko')).resolves.toBe('Halo langsung');
  });

  it('falls back to the API when single-text translation has no native module', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: {
          translatedText: 'Kucing fallback',
        },
      }),
    }) as unknown as typeof fetch;

    await expect(translateText('neko')).resolves.toBe('Kucing fallback');
  });

  it('falls back to the API when the native single-text model is not ready', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn().mockResolvedValue(false),
      translate: jest.fn().mockRejectedValue('MODEL_NOT_READY'),
      translateBatch: jest.fn(),
    };

    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: {
          translatedText: 'Kucing siap',
        },
      }),
    }) as unknown as typeof fetch;

    await expect(translateText('neko')).resolves.toBe('Kucing siap');
  });

  it('rethrows readable errors from single-text native translation', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn(),
      translate: jest.fn().mockRejectedValue(new Error('Terjemahan native gagal')),
      translateBatch: jest.fn(),
    };

    await expect(translateText('neko')).rejects.toThrow('Terjemahan native gagal');
  });

  it('reports unknown errors from single-text native translation', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn(),
      translate: jest.fn().mockRejectedValue({}),
      translateBatch: jest.fn(),
    };

    await expect(translateText('neko')).rejects.toThrow(
      'Terjadi kesalahan yang tidak diketahui',
    );
  });

  it('returns an empty array when batch input is empty', async () => {
    await expect(translateTexts([])).resolves.toEqual([]);
  });

  it('uses match-based API results when batch fallback runs without the native module', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matches: [{translation: 'Kucing'}],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          matches: [{translation: 'Anjing'}],
        }),
      }) as unknown as typeof fetch;

    await expect(translateTexts(['cat', 'dog'])).resolves.toEqual(['Kucing', 'Anjing']);
  });

  it('asks the user to download the model when batch fallback fails', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as unknown as typeof fetch;

    await expect(translateTexts(['cat'])).rejects.toThrow(
      'Unduh model terjemahan dulu saat ada WiFi',
    );
  });

  it('rejects invalid native batch payloads', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn(),
      translate: jest.fn(),
      translateBatch: jest.fn().mockResolvedValue(JSON.stringify([123])),
    };

    await expect(translateTexts(['cat'])).rejects.toThrow(
      'Format hasil terjemahan batch tidak valid',
    );
  });

  it('rethrows readable errors from native batch translation', async () => {
    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn(),
      translate: jest.fn(),
      translateBatch: jest.fn().mockRejectedValue('Server batch mati'),
    };

    await expect(translateTexts(['cat'])).rejects.toThrow('Server batch mati');
  });

  it('rejects empty API payloads during direct fallback translation', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: {},
        matches: [],
      }),
    }) as unknown as typeof fetch;

    await expect(translateText('cat')).rejects.toThrow(
      'Fallback API tidak mengembalikan hasil terjemahan',
    );
  });

  it('reports false when native translation module is unavailable', async () => {
    await expect(isTranslationModelReady()).resolves.toBe(false);
  });
});
