/**
 * @format
 */

import {NativeModules} from 'react-native';

import {
  clearTranslationCache,
  __resetPipelineStateForTests,
  requestScreenCapturePermission,
  runTranslatePipeline,
} from '../../src/services/pipeline';
import type {PipelineStatus} from '../../src/types';

describe('runTranslatePipeline', () => {
  beforeEach(() => {
    __resetPipelineStateForTests();

    NativeModules.ScreenCaptureModule = {
      requestCapturePermission: jest.fn(),
      captureScreen: jest.fn().mockResolvedValue('/cache/captures/latest.png'),
      releaseProjection: jest.fn(),
    };

    NativeModules.OcrModule = {
      recognizeText: jest.fn().mockResolvedValue({
        fullText: 'konnichiwa',
        blocks: [
          {
            text: 'konnichiwa',
            left: 12,
            top: 18,
            width: 140,
            height: 64,
            confidence: 0.92,
          },
        ],
      }),
    };

    NativeModules.TranslationModule = {
      downloadModelIfNeeded: jest.fn(),
      isModelDownloaded: jest.fn().mockResolvedValue(true),
      translate: jest.fn(),
      translateBatch: jest.fn().mockResolvedValue(JSON.stringify(['Halo dunia'])),
    };
  });

  afterEach(() => {
    delete NativeModules.ScreenCaptureModule;
    delete NativeModules.OcrModule;
    delete NativeModules.TranslationModule;
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('maps OCR blocks into translated bubbles', async () => {
    const statuses: PipelineStatus[] = [];

    const result = await runTranslatePipeline({
      onStatusChange: nextStatus => statuses.push(nextStatus),
    });

    expect(statuses).toEqual(['capturing', 'recognizing', 'translating']);
    expect(result).toEqual([
      {
        originalText: 'konnichiwa',
        translatedText: 'Halo dunia',
        position: {
          left: 12,
          top: 18,
          width: 140,
          height: 64,
        },
      },
    ]);
  });

  it('returns empty bubbles when OCR does not find valid blocks', async () => {
    NativeModules.OcrModule.recognizeText.mockResolvedValueOnce({
      fullText: '',
      blocks: [],
    });

    const result = await runTranslatePipeline();

    expect(result).toEqual([]);
    expect(NativeModules.TranslationModule.translateBatch).not.toHaveBeenCalled();
  });

  it('requests screen capture permission from the native module', async () => {
    NativeModules.ScreenCaptureModule.requestCapturePermission.mockResolvedValueOnce('granted');

    await expect(requestScreenCapturePermission()).resolves.toBe('granted');
  });

  it('fails when the screen capture module is unavailable', async () => {
    delete NativeModules.ScreenCaptureModule;

    await expect(requestScreenCapturePermission()).rejects.toThrow(
      'ScreenCaptureModule tidak tersedia di perangkat ini',
    );
    await expect(runTranslatePipeline()).rejects.toThrow(
      'ScreenCaptureModule tidak tersedia di perangkat ini',
    );
  });

  it('blocks repeated pipeline runs inside the minimum capture interval', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(3000);

    await expect(runTranslatePipeline()).resolves.toHaveLength(1);
    await expect(runTranslatePipeline()).rejects.toThrow(
      'Tunggu 1.5 detik sebelum mengambil layar lagi',
    );
    expect(NativeModules.ScreenCaptureModule.captureScreen).toHaveBeenCalledTimes(1);
  });

  it('wraps screen capture failures with a readable message', async () => {
    NativeModules.ScreenCaptureModule.captureScreen.mockRejectedValueOnce('izin belum aktif');

    await expect(runTranslatePipeline()).rejects.toThrow(
      'Gagal mengambil tangkapan layar: izin belum aktif',
    );
  });

  it('wraps OCR failures and unknown native errors', async () => {
    NativeModules.OcrModule.recognizeText.mockRejectedValueOnce({});

    await expect(runTranslatePipeline()).rejects.toThrow(
      'Gagal menjalankan OCR: Terjadi kesalahan yang tidak diketahui',
    );
  });

  it('wraps translation failures from the native layer', async () => {
    NativeModules.TranslationModule.translateBatch.mockRejectedValueOnce(
      new Error('MODEL_DOWNLOAD_FAILED'),
    );

    await expect(runTranslatePipeline()).rejects.toThrow(
      'Gagal menerjemahkan teks: MODEL_DOWNLOAD_FAILED',
    );
  });

  it('rejects mismatched translation counts from OCR input', async () => {
    NativeModules.TranslationModule.translateBatch.mockResolvedValueOnce(JSON.stringify([]));

    await expect(runTranslatePipeline()).rejects.toThrow(
      'Jumlah hasil terjemahan tidak cocok dengan input OCR',
    );
  });

  it('clears cached translations when requested', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(2000)
      .mockReturnValueOnce(4000);

    await expect(runTranslatePipeline()).resolves.toHaveLength(1);

    clearTranslationCache();
    NativeModules.TranslationModule.translateBatch.mockResolvedValueOnce(
      JSON.stringify(['Halo baru']),
    );

    await expect(runTranslatePipeline()).resolves.toEqual([
      {
        originalText: 'konnichiwa',
        translatedText: 'Halo baru',
        position: {
          left: 12,
          top: 18,
          width: 140,
          height: 64,
        },
      },
    ]);
    expect(NativeModules.TranslationModule.translateBatch).toHaveBeenCalledTimes(2);
  });
});
