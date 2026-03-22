export interface TextBlock {
  text: string;
  left: number;
  top: number;
  width: number;
  height: number;
  confidence: number;
}

export interface OcrResult {
  fullText: string;
  blocks: TextBlock[];
}

export interface TranslatedBubble {
  originalText: string;
  translatedText: string;
  position: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
}

export type PipelineStatus =
  | 'idle'
  | 'capturing'
  | 'recognizing'
  | 'translating'
  | 'displaying'
  | 'error';

export interface OverlayPermissionChangedEvent {
  granted: boolean;
}
