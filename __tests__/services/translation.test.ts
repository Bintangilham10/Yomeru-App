/**
 * @format
 */

import {NativeModules} from 'react-native';

import {
  isTranslationModelReady,
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

    await expect(translateTexts(['猫'])).resolves.toEqual(['Halo']);
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

    await expect(translateTexts(['猫'])).resolves.toEqual(['Kucing']);
  });

  it('reports false when native translation module is unavailable', async () => {
    await expect(isTranslationModelReady()).resolves.toBe(false);
  });
});
