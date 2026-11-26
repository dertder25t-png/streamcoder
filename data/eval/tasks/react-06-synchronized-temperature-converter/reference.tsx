import { useState } from "react";

const round = (n: number) => String(Math.round(n * 100) / 100);
const parse = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function TemperaturePair() {
  const [c, setC] = useState("");
  const [f, setF] = useState("");

  const onC = (v: string) => {
    setC(v);
    const n = parse(v);
    setF(Number.isFinite(n) ? round((n * 9) / 5 + 32) : "");
  };
  const onF = (v: string) => {
    setF(v);
    const n = parse(v);
    setC(Number.isFinite(n) ? round(((n - 32) * 5) / 9) : "");
  };

  return (
    <div>
      <label>
        Celsius
        <input type="text" inputMode="decimal" value={c} onChange={(e) => onC(e.target.value)} />
      </label>
      <label>
        Fahrenheit
        <input type="text" inputMode="decimal" value={f} onChange={(e) => onF(e.target.value)} />
      </label>
    </div>
  );
}
