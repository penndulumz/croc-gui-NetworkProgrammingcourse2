import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_ALLOWED_PORTS,
  DEFAULT_PUBLIC_RELAY_HOSTS,
  isPrivateOrLoopbackHost,
  parseBridgeConfig,
  resolveAllowedTarget,
} from "./bridge-allowlist.ts";

test("parseBridgeConfig falls back to official public Croc relays and ports", () => {
  const cfg = parseBridgeConfig({});
  assert.deepEqual(cfg.relayHosts, DEFAULT_PUBLIC_RELAY_HOSTS);
  assert.deepEqual(cfg.allowedPorts, DEFAULT_ALLOWED_PORTS);
});

test("parseBridgeConfig filters out private, loopback, and malformed relay hosts", () => {
  const cfg = parseBridgeConfig({
    CROC_RELAY_HOSTS: "127.0.0.1, localhost, 192.168.1.5, 169.254.169.254, relay.example.org, http://bad.host/x",
    CROC_ALLOWED_PORTS: "9009, 9010, 99999, abc",
  });
  assert.deepEqual(cfg.relayHosts, ["relay.example.org"]);
  assert.deepEqual(cfg.allowedPorts, ["9009", "9010"]);
});

test("isPrivateOrLoopbackHost blocks internal RFC1918, loopback, and metadata addresses", () => {
  for (const blocked of [
    "localhost",
    "127.0.0.1",
    "::1",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.254",
    "192.168.0.10",
    "169.254.169.254",
    "printer.local",
  ]) {
    assert.equal(isPrivateOrLoopbackHost(blocked), true, `expected ${blocked} to be blocked`);
  }
  assert.equal(isPrivateOrLoopbackHost("1.getcroc.com"), false);
  assert.equal(isPrivateOrLoopbackHost("relay.example.org"), false);
});

test("resolveAllowedTarget permits allowlisted relay index and port", () => {
  const cfg = parseBridgeConfig({});
  const result = resolveAllowedTarget(cfg, "0", "9009");
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.host, "1.getcroc.com");
    assert.equal(result.port, 9009);
    assert.equal(result.relayIndex, 0);
  }
});

test("resolveAllowedTarget rejects non-numeric indices, out-of-range indices, and disallowed ports", () => {
  const cfg = parseBridgeConfig({});

  const badIdx = resolveAllowedTarget(cfg, "abc", "9009");
  assert.equal(badIdx.ok, false);
  if (!badIdx.ok) assert.equal(badIdx.statusCode, 400);

  const outOfRange = resolveAllowedTarget(cfg, "99", "9009");
  assert.equal(outOfRange.ok, false);
  if (!outOfRange.ok) assert.equal(outOfRange.statusCode, 403);

  const badPort = resolveAllowedTarget(cfg, "0", "22");
  assert.equal(badPort.ok, false);
  if (!badPort.ok) assert.equal(badPort.statusCode, 403);
});
