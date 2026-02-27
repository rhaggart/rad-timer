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
