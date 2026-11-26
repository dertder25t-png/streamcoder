import { useEffect, useReducer, useRef, useState } from "react";

function format(ms: number): string {
  const tenths = Math.floor(ms / 100) % 10;
  const seconds = Math.floor(ms / 1000) % 60;
  const minutes = Math.floor(ms / 60000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}.${tenths}`;
}

type Lap = { total: number; split: number };

export function PrecisionTimer({ now = Date.now }: { now?: () => number }) {
  const [accumulated, setAccumulated] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [laps, setLaps] = useState<Lap[]>([]);
  const [, repaint] = useReducer((n: number) => n + 1, 0);
  const nowRef = useRef(now);
  nowRef.current = now;
  const running = startedAt !== null;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(repaint, 50);
    return () => clearInterval(id);
  }, [running]);

  const currentElapsed = () => accumulated + (startedAt !== null ? nowRef.current() - startedAt : 0);
  const elapsed = currentElapsed();

  const toggle = () => {
    if (running) {
      setAccumulated(currentElapsed());
      setStartedAt(null);
    } else {
      setStartedAt(nowRef.current());
    }
  };

  const lap = () => {
    const total = currentElapsed();
    setLaps((l) => [...l, { total, split: total - (l.length ? l[l.length - 1].total : 0) }]);
  };

  const reset = () => {
    setAccumulated(0);
    setStartedAt(null);
    setLaps([]);
  };

  return (
    <div>
      <div role="timer">{format(elapsed)}</div>
      <button type="button" onClick={toggle}>
        {running ? "Pause" : accumulated > 0 ? "Resume" : "Start"}
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
