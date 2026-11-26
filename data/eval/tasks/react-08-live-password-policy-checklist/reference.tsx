import { useEffect, useRef, useState } from "react";

const rules: { label: string; test: (p: string) => boolean }[] = [
  { label: "At least 10 characters", test: (p) => p.length >= 10 },
  { label: "An uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { label: "A digit", test: (p) => /[0-9]/.test(p) },
  { label: "A symbol", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export function PasswordPolicyMeter({ onValidChange }: { onValidChange: (valid: boolean) => void }) {
  const [password, setPassword] = useState("");
  const results = rules.map((r) => r.test(password));
  const valid = results.every(Boolean);
  const last = useRef(false);
  const cb = useRef(onValidChange);
  cb.current = onValidChange;

  useEffect(() => {
    if (last.current !== valid) {
      last.current = valid;
      cb.current(valid);
    }
  }, [valid]);

  return (
    <div>
      <input type="password" aria-label="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <ul>
        {rules.map((r, i) => (
          <li key={r.label} data-passed={results[i] ? "true" : "false"}>
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
