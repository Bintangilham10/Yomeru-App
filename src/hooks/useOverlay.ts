import {useEffect, useRef, useState} from 'react';
import {NativeEventEmitter, NativeModules} from 'react-native';

import type {
  OverlayPermissionChangedEvent,
  TranslatedBubble,
} from '../types';

type CaptureHandler = () => void | Promise<void>;

interface UseOverlayOptions {
  bubbles?: TranslatedBubble[];
  onCaptureRequested?: CaptureHandler;
}

interface OverlayNativeModule {
  addListener(eventName: string): void;
  removeListeners(count: number): void;
  checkOverlayPermission(): Promise<boolean>;
  requestOverlayPermission(): void;
  showFloatingButton(): void;
  removeFloatingButton(): void;
  updateOverlayBubbles(data: string): void;
}

function getOverlayModule(): OverlayNativeModule | null {
  return (NativeModules.OverlayModule as OverlayNativeModule | undefined) ?? null;
}

export function useOverlay(options: UseOverlayOptions = {}) {
  const overlayModule = getOverlayModule();
  const callbackRef = useRef<CaptureHandler | undefined>(options.onCaptureRequested);
  const [overlayPermissionGranted, setOverlayPermissionGranted] = useState(false);

  callbackRef.current = options.onCaptureRequested;

  useEffect(() => {
    let isMounted = true;

    if (!overlayModule) {
      return undefined;
    }

    overlayModule
      .checkOverlayPermission()
      .then(granted => {
        if (isMounted) {
          setOverlayPermissionGranted(granted);
        }
      })
      .catch(() => {
        if (isMounted) {
          setOverlayPermissionGranted(false);
        }
      });

    const emitter = new NativeEventEmitter(overlayModule);
    const captureSubscription = emitter.addListener('onCaptureRequested', () => {
      void callbackRef.current?.();
    });
    const permissionSubscription = emitter.addListener(
      'onOverlayPermissionChanged',
      (event: OverlayPermissionChangedEvent) => {
        setOverlayPermissionGranted(event.granted);
      },
    );
    const revokedSubscription = emitter.addListener('onPermissionRevoked', () => {
      setOverlayPermissionGranted(false);
    });

    return () => {
      isMounted = false;
      captureSubscription.remove();
      permissionSubscription.remove();
      revokedSubscription.remove();
    };
  }, [overlayModule]);

  useEffect(() => {
    if (!overlayModule) {
      return;
    }

    const nextBubbles = options.bubbles ?? [];
    overlayModule.updateOverlayBubbles(JSON.stringify(nextBubbles));
  }, [options.bubbles, overlayModule]);

  const requestOverlayPermission = async () => {
    overlayModule?.requestOverlayPermission();
  };

  const showFloatingButton = () => {
    overlayModule?.showFloatingButton();
  };

  const removeFloatingButton = () => {
    overlayModule?.removeFloatingButton();
  };

  return {
    overlayPermissionGranted,
    requestOverlayPermission,
    showFloatingButton,
    removeFloatingButton,
  };
}
