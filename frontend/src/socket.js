// Socket.IO client singleton. Connects via Vite's proxy in dev (same origin),
// so no extra config is needed.
import { io } from 'socket.io-client';

let _socket = null;

export const socket = () => {
  if (!_socket) {
    _socket = io({ transports: ['websocket', 'polling'] });
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

// Ask backend to flip stream-mode for `deviceId` for ~60 s. Backend will tell
// the next ESP32 POST to switch to 2 s spectrogram cycles.
export const subscribeSpectrogram   = (deviceId) => socket().emit('subscribe:spectrogram', deviceId);
export const unsubscribeSpectrogram = (deviceId) => socket().emit('unsubscribe:spectrogram', deviceId);
