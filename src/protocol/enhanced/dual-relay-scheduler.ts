/**
 * @file dual-relay-scheduler.ts
 * @description State machine for dual-relay chunk scheduling and dynamic failover.
 *
 * Architecture & Mechanism:
 * In standard single-relay transfers, if a network bottleneck or socket disconnection
 * occurs on the relay, the transfer stalls or must restart from scratch.
 *
 * CrocFlow dual-relay architecture runs two concurrent relay pipelines:
 *   - Lane Alpha (Relay 1): Assigned even chunk indices (0, 2, 4, 6...)
 *   - Lane Beta (Relay 2): Assigned odd chunk indices (1, 3, 5, 7...)
 *
 * Key characteristics:
 *   1. Bandwidth Multiplexing: Transfers stream across two separate routes concurrently.
 *   2. Dynamic Failover: If Relay Alpha drops mid-stream, triggerAlphaFailover() reroutes
 *      all undelivered Alpha chunks to Relay Beta without losing chunks already delivered.
 */

export type RelayLane = "alpha" | "beta";

/**
 * Metadata tracked for every chunk during the scheduled transfer.
 */
export interface ScheduledChunk {
  /** Global sequence index across the entire manifest (0, 1, 2, ... N) */
  globalIndex: number;
  /** Initial planned lane based on parity (even -> alpha, odd -> beta) */
  initialLane: RelayLane;
  /** Current active lane (may change to 'beta' during failover) */
  activeLane: RelayLane;
  /** Lifecycle state: pending -> in-flight -> delivered (or rerouted) */
  status: "pending" | "in-flight" | "delivered" | "rerouted";
  /** Flag marking whether this chunk was saved from a failed relay */
  rerouted: boolean;
}

/**
 * High-level observability telemetry snapshot emitted to UI inspectors and debug logs.
 */
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

  /**
   * Initializes the scheduler with chunk indices.
   * If dualEnabled is true, even chunks map to Alpha, odd chunks map to Beta.
   * If dualEnabled is false (single-relay fallback), all chunks map to Alpha.
   */
  constructor(chunkIndices: number[], dualEnabled = true) {
    this.dualEnabled = dualEnabled;
    this.betaAlive = dualEnabled;
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

  /**
   * Static deterministic lane mapping:
   * Even chunks (0, 2, 4...) -> Lane Alpha
   * Odd chunks (1, 3, 5...) -> Lane Beta
   */
  static laneForChunk(globalIndex: number, dualEnabled = true): RelayLane {
    if (!dualEnabled) return "alpha";
    return globalIndex % 2 === 0 ? "alpha" : "beta";
  }

  /**
   * Fetches the next available chunk for a specific relay lane.
   * Marks the chunk as "in-flight" to prevent duplicate concurrent dispatches.
   * Returns null if lane is offline or no chunks are pending for it.
   */
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

  /**
   * Returns the count of chunks currently in-flight on the given lane.
   */
  inFlightCountForLane(lane: RelayLane): number {
    let count = 0;
    for (const item of this.items.values()) {
      if (item.status === "in-flight" && item.activeLane === lane) {
        count += 1;
      }
    }
    return count;
  }

  /**
   * Returns the scheduled chunk descriptor for a given globalIndex if present.
   */
  getChunk(globalIndex: number): ScheduledChunk | undefined {
    const item = this.items.get(globalIndex);
    return item ? { ...item } : undefined;
  }

  /**
   * Records chunk delivery receipt upon SHA-256 verification.
   * Increments lane metrics and ensures idempotency (already delivered chunks are ignored).
   */
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
   * Marks all remaining non-delivered chunks as delivered on their active lanes.
   * Used when the peer's full-manifest `complete` confirmation arrives over a faster
   * channel ahead of trailing per-chunk ACKs on the slower channel.
   */
  markRemainingDelivered(): ScheduledChunk[] {
    const finalized: ScheduledChunk[] = [];
    for (const item of this.items.values()) {
      if (item.status !== "delivered") {
        item.status = "delivered";
        if (item.activeLane === "alpha") this.alphaDelivered += 1;
        else this.betaDelivered += 1;
        finalized.push({ ...item });
      }
    }
    return finalized;
  }

  private triggerLaneFailover(failedLane: RelayLane): number[] {
    if (failedLane === "alpha") {
      if (!this.alphaAlive) return [];
      this.alphaAlive = false;
      if (!this.betaAlive) return [];
    } else {
      if (!this.betaAlive) return [];
      this.betaAlive = false;
      if (!this.alphaAlive) return [];
    }

    const survivingLane: RelayLane = failedLane === "alpha" ? "beta" : "alpha";
    const reroutedIndices: number[] = [];

    for (const item of this.items.values()) {
      if (item.status !== "delivered" && item.activeLane === failedLane) {
        item.activeLane = survivingLane;
        item.status = "rerouted";
        item.rerouted = true;
        this.failoverReroutedCount += 1;
        reroutedIndices.push(item.globalIndex);
      }
    }
    return reroutedIndices;
  }

  /**
   * Simulates or reacts to Relay Alpha disconnect. Every pending or in-flight
   * even chunk assigned to Alpha is immediately rerouted to Relay Beta.
   *
   * @returns Array of chunk indices successfully reassigned to Beta
   */
  triggerAlphaFailover(): number[] {
    return this.triggerLaneFailover("alpha");
  }

  /**
   * Reacts to Relay Beta disconnect. Every pending or in-flight
   * odd chunk assigned to Beta is immediately rerouted to Relay Alpha.
   *
   * @returns Array of chunk indices successfully reassigned to Alpha
   */
  triggerBetaFailover(): number[] {
    return this.triggerLaneFailover("beta");
  }

  isComplete(): boolean {
    for (const item of this.items.values()) {
      if (item.status !== "delivered") return false;
    }
    return true;
  }

  isDelivered(globalIndex: number): boolean {
    return this.items.get(globalIndex)?.status === "delivered";
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
