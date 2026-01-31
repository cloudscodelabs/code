import { useState, useEffect } from 'react';

function formatElapsed(startedAtUnixSec: number): string {
  const elapsed = Math.max(0, Math.floor(Date.now() / 1000 - startedAtUnixSec));
  if (elapsed < 60) return `${elapsed}s`;
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}m ${secs}s`;
}

export function useElapsedTime(startedAtUnixSec: number): string {
  const [display, setDisplay] = useState(() => formatElapsed(startedAtUnixSec));

  useEffect(() => {
    setDisplay(formatElapsed(startedAtUnixSec));
    const id = setInterval(() => {
      setDisplay(formatElapsed(startedAtUnixSec));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAtUnixSec]);

  return display;
}
