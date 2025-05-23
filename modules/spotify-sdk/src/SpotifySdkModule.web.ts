import { registerWebModule, NativeModule } from 'expo';

import { ChangeEventPayload } from './SpotifySdk.types';

type SpotifySdkModuleEvents = {
  onChange: (params: ChangeEventPayload) => void;
}

class SpotifySdkModule extends NativeModule<SpotifySdkModuleEvents> {
  PI = Math.PI;
  async setValueAsync(value: string): Promise<void> {
    this.emit('onChange', { value });
  }
  hello() {
    return 'Hello world! 👋';
  }
};

export default registerWebModule(SpotifySdkModule, 'SpotifySdkModule');
