export function formatElapsedTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const formattedSeconds = seconds.toFixed(1).padStart(4, '0');

  if (minutes > 0) {
    return `${minutes}:${formattedSeconds}`;
  }
  return `${formattedSeconds}s`;
}

/** Format ms since epoch as HH:mm:ss.SSS for timing debug. */
export function formatDebugTimestamp(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const pad3 = (n: number) => n.toString().padStart(3, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
}
