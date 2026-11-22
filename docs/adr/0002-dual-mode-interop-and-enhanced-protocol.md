# 0002: Separate Standard Mode (Croc v11 Interop) from Enhanced Mode (Manifest and Dual-Relay)

Status: accepted

CrocFlow must interoperate byte-for-byte with official `croc` CLI and `getcroc.com`, yet also demonstrate advanced computer-networking extensions (folder trees with per-chunk SHA-256 manifest resume, incremental file additions after disconnect, and Dual-Relay even/odd chunking with failover). We decided to expose two explicit transfer modes: **Standard Mode** preserves the unmodified Croc v11 wire protocol (PAKE, HKDF, AES-256-GCM, raw DEFLATE, XXH64), while **Enhanced Mode** runs an application-layer manifest and chunk-routing protocol between CrocFlow peers.

## Considered Options

- **Modify the core Croc v11 wire framing directly**: Rejected because changing chunk headers or manifest messages breaks compatibility with official `croc` CLI and `getcroc.com`.
- **Limit features strictly to what `getcroc.com` supports**: Rejected because the coursework requires app-native capabilities and networking depth beyond the website.

## Consequences

- Standard Mode transfers can always connect seamlessly to `croc` CLI and `getcroc.com` without protocol drift.
- Users and graders clearly see which mode is active before starting a Transfer Session, preventing accidental protocol mismatches.
