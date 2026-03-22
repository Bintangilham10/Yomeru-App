/**
 * @format
 */

import {NativeModules} from 'react-native';

import {
  __resetPipelineStateForTests,
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
        fullText: 'こんにちは',
        blocks: [
          {
            text: 'こんにちは',
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
  });

  it('maps OCR blocks into translated bubbles', async () => {
    const statuses: PipelineStatus[] = [];

    const result = await runTranslatePipeline({
      onStatusChange: nextStatus => statuses.push(nextStatus),
    });

    expect(statuses).toEqual(['capturing', 'recognizing', 'translating']);
    expect(result).toEqual([
      {
        originalText: 'こんにちは',
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
});
