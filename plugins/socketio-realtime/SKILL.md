---
name: socketio-realtime
description: Socket.IO bidirectional realtime library with WebSocket-with-fallback transport, rooms, namespaces, ack callbacks, and horizontal scaling via Redis adapter. Use this skill when building chat, presence, live dashboards, or collaborative apps that need rooms, broadcasting, server-to-server emit across multiple nodes, or acknowledgements with timeouts.
---

# Socket.IO Realtime

Socket.IO is an event-based bidirectional messaging library on top of an upgrade path (HTTP long-polling → WebSocket). It adds rooms, namespaces, automatic reconnection, ack callbacks, and a binary protocol. Use it when raw WebSockets are too low-level and you need rooms/broadcasting; use plain `ws` or `Server-Sent Events` if you do not need fan-out or fallback.

## Use this skill when

- Building chat, presence, notifications, live dashboards, or collaborative editing
- Organizing connections with `rooms` (logical groups) and `namespaces` (separate event spaces)
- Implementing request/response semantics with ack callbacks and timeouts
- Scaling across multiple Node processes/hosts with `@socket.io/redis-adapter`
- Broadcasting from outside a connection scope using the server-side `emitter` API
- Authenticating connections via `io.use(middleware)` on handshake

## Do not use this skill when

- You only need server-to-client push and no fallback — Server-Sent Events are simpler
- You want a pure WebSocket protocol consumable by non-Socket.IO clients — use `ws`/native WebSocket
- The runtime is Cloudflare Workers or another edge environment without long-lived TCP connections — use Durable Objects or a managed service

## Core concepts

The Socket.IO server wraps an HTTP server. Each connected client is a `Socket` with a unique id. Sockets can `join(room)` and `leave(room)`; the server broadcasts to rooms with `io.to(room).emit(event, payload)`. *Namespaces* (e.g. `/admin`) partition the event space and have their own middleware. Across multiple Node processes, broadcasts only fan out if every node shares an *adapter* (Redis is the standard).

## Quick start

```ts
// npm i socket.io
// server
import { createServer } from "node:http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "https://example.com" },
});

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!verify(token)) return next(new Error("unauthorized"));
  socket.data.userId = userIdFromToken(token);
  next();
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.data.userId}`);

  socket.on("chat:send", async (msg, ack) => {
    const saved = await db.saveMessage(msg);
    io.to(`room:${msg.roomId}`).emit("chat:new", saved);
    ack?.({ ok: true, id: saved.id });
  });

  socket.on("disconnect", (reason) => { /* cleanup */ });
});

httpServer.listen(3000);
```

```ts
// npm i socket.io-client
import { io } from "socket.io-client";
const socket = io("https://api.example.com", { auth: { token } });
socket.emit("chat:send", { roomId: "r1", text: "hi" }, (res) => {
  console.log("ack", res);
});
```

## Key patterns

### Rooms vs namespaces
- Rooms are cheap, dynamic groups inside a namespace. Join/leave at any time.
- Namespaces are static partitions (`io.of("/admin")`) with separate middleware and event listeners.
- Default rule: one namespace per app, many rooms per use case (per-user, per-conversation, per-document).

### Ack callbacks with timeout
```ts
socket.timeout(5000).emit("op", payload, (err, res) => {
  if (err) return retry();
  use(res);
});
```
Timeouts prevent hung callbacks when the peer disconnects mid-roundtrip.

### Scaling with Redis adapter
```ts
// npm i @socket.io/redis-adapter ioredis
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
const pub = new Redis(); const sub = pub.duplicate();
io.adapter(createAdapter(pub, sub));
```
Without an adapter, `io.to(room).emit(...)` only reaches clients on the local process. Behind a load balancer enable sticky sessions (or use the Redis adapter and disable HTTP long-polling).

### Server-side broadcasting from outside
```ts
import { Emitter } from "@socket.io/redis-emitter";
const emitter = new Emitter(pub);
emitter.to(`user:${userId}`).emit("notify", { msg: "hello" });
```
For background workers or HTTP handlers that need to push events without an `io` instance.

### Authentication
- Pass tokens via `socket.handshake.auth` (preferred) or `query`. Do not put secrets in query strings.
- Validate in `io.use((socket, next) => ...)`; failing `next(err)` rejects the connection.

### Backpressure and large payloads
- Default `maxHttpBufferSize` is 1MB; raise carefully or stream large blobs out of band (signed URL).
- Use binary by passing `Buffer`/`Uint8Array` directly; Socket.IO encodes binary natively.

### Disconnect reasons
- `"transport close"`: client network dropped.
- `"client namespace disconnect"`: client called `socket.disconnect()`.
- `"ping timeout"`: client unresponsive.
- `"server namespace disconnect"`: server called `socket.disconnect()`.

## Common pitfalls

- Running multiple Node processes without the Redis adapter; events emitted on node A do not reach clients on node B.
- Behind a load balancer without sticky sessions AND with long-polling enabled, the polling cycle bounces across nodes and the handshake fails. Either enable sticky sessions or force `transports: ["websocket"]`.
- Joining a room inside `connection` and then immediately emitting to it from elsewhere; the `join` is async-safe but the broadcast must happen AFTER `join` resolves.
- Forgetting to call the ack callback; the sender's `socket.timeout(...)` will fire an error.
- Storing state on `socket` directly instead of `socket.data`; collisions with internals are possible.
- CORS misconfigured for cross-origin; the handshake fails before any `connection` event.
- Mixing incompatible client and server major versions (v2 client + v4 server) — wire protocols differ.
- Treating disconnect as final; clients auto-reconnect by default and the same user gets a new `socket.id`.

## Reference
- Official docs: https://socket.io/docs/v4/
- Related: [[fastify-nodejs]], [[hono-edge-framework]]
