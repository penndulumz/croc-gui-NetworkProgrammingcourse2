/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface CrocRuntimeConfig {
  gatewayURL?: string;
  localDualRelayURL?: string;
  relayAddresses?: string[];
  relayPassword?: string;
}

declare global {
  interface Window {
    __CROC_RUNTIME_CONFIG__?: CrocRuntimeConfig;
  }
}

export {};
