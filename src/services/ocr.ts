import {NativeModules} from 'react-native';

import type {OcrResult} from '../types';

interface OcrNativeModule {
  recognizeText(imagePath: string): Promise<OcrResult>;
}

function getOcrModule(): OcrNativeModule | null {
  return (NativeModules.OcrModule as OcrNativeModule | undefined) ?? null;
}

export async function recognizeText(imagePath: string): Promise<OcrResult> {
  const module = getOcrModule();

  if (!module) {
    throw new Error('OcrModule tidak tersedia di perangkat ini');
  }

  return module.recognizeText(imagePath);
}
