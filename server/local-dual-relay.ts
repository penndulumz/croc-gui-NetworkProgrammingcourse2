import type { WebSocket } from "ws";

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

export function isValidLocalChannel(value: string | null): value is LocalRelayChannel {
  return value === "alpha" || value === "beta";
}

export function isValidRoomId(value: string | null): value is string {
  return Boolean(value && /^[a-zA-Z0-9_-]{4,128}$/.test(value));
}

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
      const currentPeers = channelMap.get(roomId);
      if (!currentPeers) return;
      currentPeers.delete(peer);
      if (currentPeers.size === 0) {
        channelMap.delete(roomId);
      } else {
        this.notifyPeerCount(channel, roomId);
      }
    };

    socket.on("close", cleanup);
    socket.on("error", cleanup);
  }

  private notifyPeerCount(channel: LocalRelayChannel, roomId: string) {
    const peers = this.channels[channel].get(roomId);
    if (!peers) return;
    const roles = Array.from(peers).map((p) => p.role);
    const payload = JSON.stringify({
      type: "relay-room-state",
      channel,
      room: roomId,
      peerCount: peers.size,
      hasSender: roles.includes("sender"),
      hasReceiver: roles.includes("receiver"),
    });
    for (const p of peers) {
      if (p.socket.readyState === p.socket.OPEN) {
        p.socket.send(payload);
      }
    }
  }

  getStats(): LocalDualRelayStats {
    const countConns = (map: Map<string, Set<RoomPeer>>) => {
      let total = 0;
      for (const set of map.values()) total += set.size;
      return total;
    };
    return {
      alpha: {
        online: true,
        activeRooms: this.channels.alpha.size,
        activeConnections: countConns(this.channels.alpha),
        bytesRelayed: this.metrics.alpha.bytes,
        chunksRelayed: this.metrics.alpha.chunks,
      },
      beta: {
        online: true,
        activeRooms: this.channels.beta.size,
        activeConnections: countConns(this.channels.beta),
        bytesRelayed: this.metrics.beta.bytes,
        chunksRelayed: this.metrics.beta.chunks,
      },
    };
  }
}

// Deprecated alias for backwards compatibility
export { LocalDualRelayNode as LocalDualRelayHub };
