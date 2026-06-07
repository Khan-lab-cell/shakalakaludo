// Shared constants for the Ludo Royal app.

// Heartbeat interval: how often the client pings last_seen (ms).
export const HEARTBEAT_INTERVAL_MS = 5000;

// Disconnect threshold: a player is considered disconnected if no heartbeat
// for this long. Must be > HEARTBEAT_INTERVAL_MS (typically 3x).
export const DISCONNECT_THRESHOLD_MS = 15000;

// Available turn timer options (seconds).
export const TURN_TIMER_OPTIONS = [30, 60];
