import test from "node:test";
import assert from "node:assert/strict";
import { deriveBridgeURL } from "./bridge-client.ts";

test("deriveBridgeURL derives ws:// for http: and wss:// for https:", () => {
  assert.equal(deriveBridgeURL("http:", "localhost:3000"), "ws://localhost:3000/ws");
  assert.equal(deriveBridgeURL("http", "localhost:3000"), "ws://localhost:3000/ws");
  assert.equal(deriveBridgeURL("https:", "crocflow.example.com"), "wss://crocflow.example.com/ws");
  assert.equal(deriveBridgeURL("https", "crocflow.example.com"), "wss://crocflow.example.com/ws");
  assert.equal(deriveBridgeURL("ws:", "127.0.0.1:8080"), "ws://127.0.0.1:8080/ws");
  assert.equal(deriveBridgeURL("wss:", "127.0.0.1:8080"), "wss://127.0.0.1:8080/ws");
});

test("deriveBridgeURL supports custom paths with or without leading slash", () => {
  assert.equal(
    deriveBridgeURL("http:", "127.0.0.1:3000", "/ws-dual"),
    "ws://127.0.0.1:3000/ws-dual",
  );
  assert.equal(
    deriveBridgeURL("https:", "127.0.0.1:3000", "ws-dual"),
    "wss://127.0.0.1:3000/ws-dual",
  );
});

test("deriveBridgeURL trims trailing slashes from host", () => {
  assert.equal(
    deriveBridgeURL("http:", "localhost:3000///", "/ws"),
    "ws://localhost:3000/ws",
  );
});
