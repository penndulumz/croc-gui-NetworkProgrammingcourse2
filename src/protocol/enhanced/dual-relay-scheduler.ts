/**
 * @file dual-relay-scheduler.ts
 * @description State machine for dual-relay chunk scheduling and dynamic failover.
 *
 * Architecture & Mechanism / Kiến trúc & Cơ chế hoạt động:
 * In standard single-relay transfers, if a network bottleneck or socket disconnection
 * occurs on the relay, the transfer stalls or must restart from scratch.
 *
 * CrocFlow Dual-Relay Transfer runs two concurrent Relay Node pipelines:
 *   - Relay Alpha: Gán các Chunk chỉ số chẵn (0, 2, 4, 6...)
 *   - Relay Beta:  Gán các Chunk chỉ số lẻ (1, 3, 5, 7...)
 *
 * Key characteristics:
 *   1. Bandwidth Multiplexing: Truyền song song qua 2 tuyến Relay độc lập để tăng thông lượng.
 *   2. Symmetric Dynamic Failover: Khi Relay Alpha hoặc Relay Beta đứt kết nối giữa phiên,
 *      triggerAlphaFailover() / triggerBetaFailover() (thông qua triggerLaneFailover) lập tức
 *      chuyển hướng toàn bộ Chunk chưa được xác nhận sang Relay còn sống mà không mất dữ liệu đã nhận.
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
  /** Current active lane (may change to the surviving lane 'beta' or 'alpha' during Failover) */
  activeLane: RelayLane;
  /**
   * Vòng đời trạng thái của mỗi Chunk:
   * - `pending`: chưa từng cấp phát cho worker nào.
   * - `in-flight`: đã giao cho worker gửi đi, đang chờ `chunk-ack` xác thực SHA-256 từ máy nhận.
   * - `rerouted`: từng thuộc lane bị đứt (`pending` hoặc `in-flight`), đã chuyển sang lane sống chờ phát lại.
   * - `delivered`: máy nhận đã xác nhận toàn vẹn (hoặc đã đối soát qua `complete`).
   */
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
 * Máy trạng thái thuần túy điều phối phân bổ Chunk chẵn/lẻ trong Dual-Relay Transfer
 * và thực hiện Failover tự động đối xứng khi Relay Alpha hoặc Relay Beta mất kết nối giữa phiên.
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
   * Khởi tạo bộ lập lịch từ danh sách chỉ số Chunk cần truyền (thường là `missingIndices` sau Resume Cache).
   * - Khi `dualEnabled = true`: áp dụng chia chẵn/lẻ — Chunk chẵn (0, 2, 4...) đi qua Relay Alpha,
   *   Chunk lẻ (1, 3, 5...) đi qua Relay Beta.
   * - Khi `dualEnabled = false` (chế độ 1 kênh Relay Alpha): toàn bộ Chunk gán vào Relay Alpha và `betaAlive = false`.
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
   * Lấy Chunk kế tiếp sẵn sàng phát trên `lane` (`pending` hoặc `rerouted` sau Failover).
   * Chuyển ngay trạng thái sang `"in-flight"` để tránh hai worker hoặc vòng lặp cấp phát trùng một Chunk.
   * Trả về `null` nếu lane đã ngoại tuyến hoặc không còn Chunk chờ trên lane này.
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
   * Đếm số Chunk đang ở trạng thái `"in-flight"` trên một lane.
   * Worker dựa vào bộ đếm này để giữ cửa sổ pipelining không vượt quá `MAX_IN_FLIGHT_PER_LANE` (4),
   * giúp tăng thông lượng nhiều Chunk/RTT mà vẫn kiểm soát được bộ đệm khi xảy ra Failover.
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
   * Ghi nhận Chunk đã được máy nhận kiểm tra SHA-256 và xác nhận qua `chunk-ack`.
   * Cập nhật bộ đếm theo lane thực tế đã giao (`deliveredOnLane`) và đảm bảo tính idempotent
   * (nếu `chunk-ack` trùng lặp đến sau Failover thì bỏ qua, không cộng dồn metrics).
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
   * Đối soát và chốt toàn bộ các Chunk còn lại chưa ở trạng thái `"delivered"` thành `"delivered"`.
   * Vì sao cần: Trong Dual-Relay Transfer, máy nhận phát `complete` trên cả hai kênh ngay khi
   * ghép và xác thực xong toàn bộ Folder Manifest; thông điệp `complete` đi qua kênh nhanh hơn có thể
   * vượt mặt (overtake) các `chunk-ack` cuối cùng đang còn trên đường truyền từ kênh chậm hơn.
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

  /**
   * Chuyển đổi Failover đối xứng dùng chung cho cả Relay Alpha và Relay Beta:
   * 1. Đánh dấu `failedLane` ngoại tuyến (idempotent nếu lane đã tắt trước đó).
   * 2. Nếu lane đối ứng còn sống, chuyển toàn bộ Chunk chưa `delivered` (`pending` hoặc `in-flight`)
   *    đang gán cho `failedLane` sang `survivingLane`, đổi trạng thái thành `"rerouted"` và bật cờ `rerouted = true`
   *    để worker của lane còn sống nhận việc và truyền bù ngay lập tức.
   * 3. Nếu cả hai lane đều đã tắt thì trả về `[]` vì không còn đường chuyển hướng.
   */
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
