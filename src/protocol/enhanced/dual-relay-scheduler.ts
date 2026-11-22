export type RelayLane = "alpha" | "beta";

export interface ScheduledChunk {
  globalIndex: number;
  initialLane: RelayLane;
  activeLane: RelayLane;
  status: "pending" | "in-flight" | "delivered" | "rerouted";
  rerouted: boolean;
}

export interface DualRelaySnapshot {
  dualEnabled: boolean;
  alphaAlive: boolean;
  betaAlive: boolean;
  total: number;
  deliveredCount: number;
  alphaDelivered: number;
  betaDelivered: number;
  failoverReroutedCount: number;
}

/**
 * Pure state machine implementing Dual-Relay Even/Odd chunk allocation
 * and automatic Failover when Relay Alpha disconnects mid-transfer.
 */
export class DualRelayScheduler {
  private items = new Map<number, ScheduledChunk>();
  private dualEnabled: boolean;
  private alphaAlive = true;
  private betaAlive = true;
  private alphaDelivered = 0;
  private betaDelivered = 0;
  private failoverReroutedCount = 0;

  constructor(chunkIndices: number[], dualEnabled = true) {
    this.dualEnabled = dualEnabled;
    for (const idx of chunkIndices) {
      const lane: RelayLane = dualEnabled ? (idx % 2 === 0 ? "alpha" : "beta") : "alpha";
      this.items.set(idx, {
        globalIndex: idx,
        initialLane: lane,
        activeLane: lane,
        status: "pending",
        rerouted: false,
      });
    }
  }

  static laneForChunk(globalIndex: number, dualEnabled = true): RelayLane {
    if (!dualEnabled) return "alpha";
    return globalIndex % 2 === 0 ? "alpha" : "beta";
  }

  nextForLane(lane: RelayLane): ScheduledChunk | null {
    if (lane === "alpha" && !this.alphaAlive) return null;
    if (lane === "beta" && !this.betaAlive) return null;

    for (const item of this.items.values()) {
      if ((item.status === "pending" || item.status === "rerouted") && item.activeLane === lane) {
        item.status = "in-flight";
        return { ...item };
      }
    }
    return null;
  }

  markDelivered(globalIndex: number, deliveredOnLane: RelayLane): boolean {
    const item = this.items.get(globalIndex);
    if (!item || item.status === "delivered") return false;
    item.status = "delivered";
    item.activeLane = deliveredOnLane;
    if (deliveredOnLane === "alpha") this.alphaDelivered += 1;
    else this.betaDelivered += 1;
    return true;
  }

  /**
   * Simulates or reacts to Relay Alpha disconnect. Every pending or in-flight
   * even chunk assigned to Alpha is immediately rerouted to Relay Beta.
   */
  triggerAlphaFailover(): number[] {
    if (!this.alphaAlive) return [];
    this.alphaAlive = false;
    const reroutedIndices: number[] = [];

    if (!this.betaAlive) return reroutedIndices;

    for (const item of this.items.values()) {
      if (item.status !== "delivered" && item.activeLane === "alpha") {
        item.activeLane = "beta";
        item.status = "rerouted";
        item.rerouted = true;
        this.failoverReroutedCount += 1;
        reroutedIndices.push(item.globalIndex);
      }
    }
    return reroutedIndices;
  }

  isComplete(): boolean {
    for (const item of this.items.values()) {
      if (item.status !== "delivered") return false;
    }
    return true;
  }

  getSnapshot(): DualRelaySnapshot {
    let deliveredCount = 0;
    for (const item of this.items.values()) {
      if (item.status === "delivered") deliveredCount += 1;
    }
    return {
      dualEnabled: this.dualEnabled,
      alphaAlive: this.alphaAlive,
      betaAlive: this.betaAlive,
      total: this.items.size,
      deliveredCount,
      alphaDelivered: this.alphaDelivered,
      betaDelivered: this.betaDelivered,
      failoverReroutedCount: this.failoverReroutedCount,
    };
  }
}
