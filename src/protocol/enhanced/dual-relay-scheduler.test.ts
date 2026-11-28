import test from "node:test";
import assert from "node:assert/strict";
import { DualRelayScheduler } from "./dual-relay-scheduler.ts";

test("DualRelayScheduler strictly assigns even chunks to Alpha and odd chunks to Beta", () => {
  const scheduler = new DualRelayScheduler([0, 1, 2, 3, 4, 5], true);

  const alphaAssigned: number[] = [];
  const betaAssigned: number[] = [];

  for (;;) {
    const a = scheduler.nextForLane("alpha");
    if (!a) break;
    alphaAssigned.push(a.globalIndex);
    scheduler.markDelivered(a.globalIndex, "alpha");
  }
  for (;;) {
    const b = scheduler.nextForLane("beta");
    if (!b) break;
    betaAssigned.push(b.globalIndex);
    scheduler.markDelivered(b.globalIndex, "beta");
  }

  assert.deepEqual(alphaAssigned, [0, 2, 4]);
  assert.deepEqual(betaAssigned, [1, 3, 5]);
  assert.equal(scheduler.isComplete(), true);
  const snap = scheduler.getSnapshot();
  assert.equal(snap.alphaDelivered, 3);
  assert.equal(snap.betaDelivered, 3);
  assert.equal(snap.failoverReroutedCount, 0);
});

test("DualRelayScheduler reroutes remaining and in-flight even chunks to Beta on Alpha failover", () => {
  const scheduler = new DualRelayScheduler([0, 1, 2, 3, 4, 5], true);

  // Deliver chunk 0 on Alpha and start chunk 2 in-flight on Alpha
  const c0 = scheduler.nextForLane("alpha");
  assert.equal(c0?.globalIndex, 0);
  scheduler.markDelivered(0, "alpha");

  const c2InFlight = scheduler.nextForLane("alpha");
  assert.equal(c2InFlight?.globalIndex, 2);

  // Deliver chunk 1 on Beta
  const c1 = scheduler.nextForLane("beta");
  assert.equal(c1?.globalIndex, 1);
  scheduler.markDelivered(1, "beta");

  // Relay Alpha drops! Both in-flight chunk 2 and pending chunk 4 must failover to Beta
  const rerouted = scheduler.triggerAlphaFailover();
  assert.deepEqual(rerouted, [2, 4]);
  assert.equal(scheduler.nextForLane("alpha"), null);

  // Relay Beta drains all remaining chunks (2, 3, 4, 5)
  const betaDeliveredRest: number[] = [];
  for (;;) {
    const next = scheduler.nextForLane("beta");
    if (!next) break;
    betaDeliveredRest.push(next.globalIndex);
    scheduler.markDelivered(next.globalIndex, "beta");
  }

  assert.deepEqual(betaDeliveredRest.sort((a, b) => a - b), [2, 3, 4, 5]);
  assert.equal(scheduler.isComplete(), true);

  const snap = scheduler.getSnapshot();
  assert.equal(snap.alphaAlive, false);
  assert.equal(snap.alphaDelivered, 1);
  assert.equal(snap.betaDelivered, 5);
  assert.equal(snap.failoverReroutedCount, 2);
});

test("DualRelayScheduler reroutes remaining and in-flight odd chunks to Alpha on Beta failover and tracks in-flight counts", () => {
  const scheduler = new DualRelayScheduler([0, 1, 2, 3, 4, 5], true);

  const c0 = scheduler.nextForLane("alpha");
  const c1 = scheduler.nextForLane("beta");
  const c3 = scheduler.nextForLane("beta");
  assert.equal(c0?.globalIndex, 0);
  assert.equal(c1?.globalIndex, 1);
  assert.equal(c3?.globalIndex, 3);
  assert.equal(scheduler.inFlightCountForLane("alpha"), 1);
  assert.equal(scheduler.inFlightCountForLane("beta"), 2);

  scheduler.markDelivered(1, "beta");
  assert.equal(scheduler.inFlightCountForLane("beta"), 1);

  // Relay Beta drops! In-flight chunk 3 and pending chunk 5 must failover to Alpha
  const rerouted = scheduler.triggerBetaFailover();
  assert.deepEqual(rerouted, [3, 5]);
  assert.equal(scheduler.nextForLane("beta"), null);
  assert.equal(scheduler.inFlightCountForLane("beta"), 0);

  const alphaRest: number[] = [];
  for (;;) {
    const next = scheduler.nextForLane("alpha");
    if (!next) break;
    alphaRest.push(next.globalIndex);
    scheduler.markDelivered(next.globalIndex, "alpha");
  }
  scheduler.markDelivered(0, "alpha");

  assert.deepEqual(alphaRest.sort((a, b) => a - b), [2, 3, 4, 5]);
  assert.equal(scheduler.isComplete(), true);
  const snap = scheduler.getSnapshot();
  assert.equal(snap.betaAlive, false);
  assert.equal(snap.alphaAlive, true);
  assert.equal(snap.failoverReroutedCount, 2);
});
