import * as React from 'react';

import { SpotifySdkViewProps } from './SpotifySdk.types';

export default function SpotifySdkView(props: SpotifySdkViewProps) {
  return (
    <div>
      <iframe
        style={{ flex: 1 }}
        src={props.url}
        onLoad={() => props.onLoad({ nativeEvent: { url: props.url } })}
      />
    </div>
  );
}
