// Socket.IO client singleton. Connects via Vite's proxy in dev (same origin),
// so no extra config is needed.
import { io } from 'socket.io-client';

let _socket = null;

export const socket = () => {
  if (!_socket) {
    // Auto-reconnect with backoff so a venue WiFi/socket drop recovers WITHOUT
    // a page reload (Phase 3 resilience). These are socket.io defaults, made
    // explicit + capped so the UI's "reconnecting" state is predictable.
    _socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 8000,
    });
    if (typeof window !== 'undefined') {
      window.__pgSocket = _socket;          // handy for browser-console debugging
    }
  }
  return _socket;
};

// Subscribe to a server-emitted event for the lifetime of a React effect.
// Returns the cleanup function the caller's useEffect should return.
export const onEvent = (event, handler) => {
  const s = socket();
  s.on(event, handler);
  return () => s.off(event, handler);
};

// Subscribe to live-link connection changes. Calls handler(connected:boolean)
// immediately and on every connect/disconnect. Returns a cleanup fn.
export const onConnection = (handler) => {
  const s = socket();
  const up = () => handler(true);
  const down = () => handler(false);
  s.on('connect', up);
  s.on('disconnect', down);
  s.io.on('reconnect', up);
  handler(s.connected);
  return () => { s.off('connect', up); s.off('disconnect', down); s.io.off('reconnect', up); };
};

// Ask backend to flip stream-mode for `deviceId` for ~60 s. Backend will tell
// the next ESP32 POST to switch to 2 s spectrogram cycles.
export const subscribeSpectrogram   = (deviceId) => socket().emit('subscribe:spectrogram', deviceId);
export const unsubscribeSpectrogram = (deviceId) => socket().emit('unsubscribe:spectrogram', deviceId);
