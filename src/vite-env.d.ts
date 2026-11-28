/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface CrocRuntimeConfig {
  bridgeURL?: string;
  localDualRelayURL?: string;
  relayAddresses?: string[];
  relayPassword?: string;
}

declare global {
  interface ImportMetaEnv {
    readonly VITE_CROCFLOW_BRIDGE_ORIGIN?: string;
  }

  interface Window {
    __CROC_RUNTIME_CONFIG__?: CrocRuntimeConfig;
  }
}

export {};
