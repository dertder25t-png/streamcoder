import { useEffect, useRef, useState } from "react";

function format(ms: number): string {
  const tenths = Math.floor(ms / 100) % 10;
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
}

type Lap = { total: number; split: number };

export function PrecisionTimer({ now = Date.now }: { now?: () => number }) {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<Lap[]>([]);
  const lastLap = useRef(0);
  const start = useRef(now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const current = now();
      setElapsed((e) => e + (current - start.current));
      start.current = current;
    }, 100);
    return () => clearInterval(id);
  }, [running, now]);

  const toggle = () => {
    if (!running) setElapsed(0);
    setRunning(!running);
  };

  const lap = () => {
    const total = elapsed;
    const split = total - lastLap.current;
    setLaps([...laps, { total, split }]);
    lastLap.current = total;
  };

  const reset = () => {
    setElapsed(0);
    setLaps([]);
    lastLap.current = 0;
    start.current = now();
  };

  return (
    <div>
      <div role="timer">{format(elapsed)}</div>
      <button type="button" onClick={toggle}>
        {running ? "Pause" : elapsed > 0 ? "Resume" : "Start"}
      </button>
      <button type="button" onClick={lap} disabled={!running}>
        Lap
      </button>
      <button type="button" onClick={reset}>
        Reset
      </button>
      <ol>
        {laps.map((l, i) => (
          <li key={i}>
            Lap {i + 1}: {format(l.total)} (+{format(l.split)})
          </li>
        ))}
      </ol>
    </div>
  );
}
