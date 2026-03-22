/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

import {TranslationOverlay} from '../../src/components/TranslationOverlay';

describe('TranslationOverlay', () => {
  it('renders translated bubble content', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TranslationOverlay
          bubbles={[
            {
              originalText: 'こんにちは',
              translatedText: 'Halo dunia',
              position: {
                left: 24,
                top: 32,
                width: 120,
                height: 56,
              },
            },
          ]}
        />,
      );
    });

    const texts = renderer!.root
      .findAllByType(Text)
      .map(node => node.props.children)
      .flat();

    expect(texts).toContain('Halo dunia');
  });
});
