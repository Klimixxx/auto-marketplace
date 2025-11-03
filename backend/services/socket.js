// backend/services/socket.js
let ioInstance = null;

export function setSocketInstance(io) {
  ioInstance = io;
}

export function getSocket() {
  return ioInstance;
}
