import { requireNativeView } from 'expo';
import * as React from 'react';

import { SpotifySdkViewProps } from './SpotifySdk.types';

const NativeView: React.ComponentType<SpotifySdkViewProps> =
  requireNativeView('SpotifySdk');

export default function SpotifySdkView(props: SpotifySdkViewProps) {
  return <NativeView {...props} />;
}
