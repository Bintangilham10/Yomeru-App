import {useEffect, useState} from 'react';

import {
  runTranslatePipeline,
  __resetPipelineStateForTests,
} from '../services/pipeline';
import {
  downloadTranslationModel,
  isTranslationModelReady,
} from '../services/translation';
import type {PipelineStatus, TranslatedBubble} from '../types';

interface TranslatePipelineState {
  status: PipelineStatus;
  bubbles: TranslatedBubble[];
  error: string | null;
  isModelReady: boolean;
  runPipeline: () => Promise<TranslatedBubble[]>;
  clearBubbles: () => void;
  downloadModel: () => Promise<void>;
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

export function useTranslatePipeline(): TranslatePipelineState {
  const [status, setStatus] = useState<PipelineStatus>('idle');
  const [bubbles, setBubbles] = useState<TranslatedBubble[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isModelReady, setIsModelReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    isTranslationModelReady()
      .then(modelReady => {
        if (isMounted) {
          setIsModelReady(modelReady);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsModelReady(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const runPipeline = async () => {
    setError(null);

    try {
      const nextBubbles = await runTranslatePipeline({
        onStatusChange: nextStatus => setStatus(nextStatus),
      });

      setBubbles(nextBubbles);
      setStatus(nextBubbles.length ? 'displaying' : 'idle');
      return nextBubbles;
    } catch (pipelineError) {
      const message = getErrorMessage(pipelineError);
      setStatus('error');
      setError(message);
      throw pipelineError;
    }
  };

  const clearBubbles = () => {
    setBubbles([]);
    setStatus('idle');
    setError(null);
  };

  const downloadModel = async () => {
    setError(null);

    try {
      const downloaded = await downloadTranslationModel();
      setIsModelReady(downloaded);
    } catch (downloadError) {
      setStatus('error');
      setError(getErrorMessage(downloadError));
    }
  };

  return {
    status,
    bubbles,
    error,
    isModelReady,
    runPipeline,
    clearBubbles,
    downloadModel,
  };
}

export {__resetPipelineStateForTests};
