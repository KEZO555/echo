// Reexport the native module. On web, it will be resolved to SpotifySdkModule.web.ts
// and on native platforms to SpotifySdkModule.ts
export { default } from "./src/SpotifySdkModule";
export * from "./src/SpotifySdk.types";
