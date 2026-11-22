import type { WebSocket } from "ws";

/**
 * Local Dual-Relay Lab Channel Identifier.
 * Alpha = Even Chunks channel (0, 2, 4...)
 * Beta = Odd Chunks channel (1, 3, 5...) + Failover fallback channel
 */
export type LocalRelayChannel = "alpha" | "beta";

interface RoomPeer {
  id: string;
  role: "sender" | "receiver";
  socket: WebSocket;
}

export interface LocalDualRelayStats {
  alpha: {
    online: boolean;
    activeRooms: number;
    activeConnections: number;
    bytesRelayed: number;
    chunksRelayed: number;
  };
  beta: {
    online: boolean;
    activeRooms: number;
    activeConnections: number;
    bytesRelayed: number;
    chunksRelayed: number;
  };
}

/**
 * Validates that an incoming channel query parameter is strictly 'alpha' or 'beta'.
 */
export function isValidLocalChannel(value: string | null): value is LocalRelayChannel {
  return value === "alpha" || value === "beta";
}

/**
 * Validates that a room identifier matches alphanumeric and hyphen/underscore safe characters.
 */
export function isValidRoomId(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{4,128}$/.test(value));
}

/**
 * In-Memory Local Dual-Relay Lab Node (`/ws-dual`).
 *
 * ## Architecture & Rationale:
 * Allows developers and evaluators to test multi-path transfer and live failover
 * without requiring external cloud servers or public internet connectivity.
 *
 * Provides two completely isolated channels:
 * - `Relay Alpha`: Streams even-indexed chunks.
 * - `Relay Beta`: Streams odd-indexed chunks and takes over even chunks during failover.
 *
 * Features:
 * - Room-scoped peer pairing (peers in the same room exchange opaque binary chunks).
 * - Real RTT latency measurement via lightweight `__ping__`/`__pong__` frames.
 * - Live byte and chunk counters exposed via `/api/relays/status`.
 */
export class LocalDualRelayNode {
  private channels: Record<LocalRelayChannel, Map<string, Set<RoomPeer>>> = {
    alpha: new Map(),
    beta: new Map(),
  };

  private metrics: Record<LocalRelayChannel, { bytes: number; chunks: number }> = {
    alpha: { bytes: 0, chunks: 0 },
    beta: { bytes: 0, chunks: 0 },
  };

  private peerSeq = 0;

  /**
   * Joins a WebSocket client into a channel and room.
   */
  join(
    channel: LocalRelayChannel,
    roomId: string,
    role: "sender" | "receiver",
    socket: WebSocket,
  ) {
    const channelMap = this.channels[channel];
    let peers = channelMap.get(roomId);
    if (!peers) {
      peers = new Set();
      channelMap.set(roomId, peers);
    }

    const peer: RoomPeer = {
      id: `${channel}-${++this.peerSeq}`,
      role,
      socket,
    };
    peers.add(peer);

    // Notify existing peers and the newly joined peer that a counterpart is present
    this.notifyPeerCount(channel, roomId);

    socket.on("message", (data, isBinary) => {
      const byteLength = Buffer.isBuffer(data)
        ? data.byteLength
        : Array.isArray(data)
          ? data.reduce((sum, b) => sum + b.byteLength, 0)
          : data instanceof ArrayBuffer
            ? data.byteLength
            : Buffer.byteLength(String(data));

      // Lightweight ping/pong control frame for real RTT measurement
      if (!isBinary) {
        const text = data.toString("utf8");
        if (text === "__ping__") {
          if (socket.readyState === socket.OPEN) {
            socket.send("__pong__");
          }
          return;
        }
      }

      const currentPeers = channelMap.get(roomId);
      if (!currentPeers) return;

      for (const other of currentPeers) {
        if (other.id === peer.id) continue;
        if (other.socket.readyState === other.socket.OPEN) {
          other.socket.send(data, { binary: isBinary });
          this.metrics[channel].bytes += byteLength;
          this.metrics[channel].chunks += 1;
        }
      }
    });

    const cleanup = () => {
      const cur = channelMap.get(roomId);
      if (cur) {
        cur.delete(peer);
        if (cur.size === 0) {
          channelMap.delete(roomId);
        } else {
          this.notifyPeerCount(channel, roomId);
        }
      }
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
  }

  private notifyPeerCount(channel: LocalRelayChannel, roomId: string) {
    const peers = this.channels[channel].get(roomId);
    if (!peers) return;
    const count = peers.size;
    const msg = JSON.stringify({ type: "peer_count", channel, roomId, count });
    for (const p of peers) {
      if (p.socket.readyState === p.socket.OPEN) {
        try {
          p.socket.send(msg);
        } catch {
          // ignore send errors on stale sockets
        }
      }
    }
  }

  /**
   * Returns live operational metrics for both Alpha and Beta channels.
   */
  getStats(): LocalDualRelayStats {
    let alphaConns = 0;
    for (const set of this.channels.alpha.values()) {
      alphaConns += set.size;
    }
    let betaConns = 0;
    for (const set of this.channels.beta.values()) {
      betaConns += set.size;
    }

    return {
      alpha: {
        online: true,
        activeRooms: this.channels.alpha.size,
        activeConnections: alphaConns,
        bytesRelayed: this.metrics.alpha.bytes,
        chunksRelayed: this.metrics.alpha.chunks,
      },
      beta: {
        online: true,
        activeRooms: this.channels.beta.size,
        activeConnections: betaConns,
        bytesRelayed: this.metrics.beta.bytes,
        chunksRelayed: this.metrics.beta.chunks,
      },
    };
  }

  /**
   * Resets all room assignments and traffic counters (useful for unit tests).
   */
  reset() {
    this.channels.alpha.clear();
    this.channels.beta.clear();
    this.metrics.alpha = { bytes: 0, chunks: 0 };
    this.metrics.beta = { bytes: 0, chunks: 0 };
    this.peerSeq = 0;
  }
}
