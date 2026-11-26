import { useRef, useState } from "react";

export type Flag = { id: string; label: string; enabled: boolean };

export function OptimisticFeatureFlags({
  flags,
  onToggle,
}: {
  flags: Flag[];
  onToggle: (id: string, nextEnabled: boolean) => Promise<void>;
}) {
  const [values, setValues] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(flags.map((f) => [f.id, f.enabled])),
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inFlight = useRef(new Set<string>());
  const confirmed = useRef<Record<string, boolean>>(Object.fromEntries(flags.map((f) => [f.id, f.enabled])));

  const toggle = (id: string) => {
    if (inFlight.current.has(id)) return;
    inFlight.current.add(id);
    const next = !values[id];
    setValues((v) => ({ ...v, [id]: next }));
    setErrors((e) => {
      const { [id]: _removed, ...rest } = e;
      return rest;
    });
    onToggle(id, next).then(
      () => {
        confirmed.current[id] = next;
        inFlight.current.delete(id);
      },
      () => {
        inFlight.current.delete(id);
        setValues((v) => ({ ...v, [id]: confirmed.current[id] }));
        setErrors((e) => ({ ...e, [id]: "Could not update this flag. Change was reverted." }));
      },
    );
  };

  return (
    <ul>
      {flags.map((f) => (
        <li key={f.id}>
          <label>
            <input type="checkbox" role="switch" checked={values[f.id] ?? f.enabled} onChange={() => toggle(f.id)} />
            {f.label}
          </label>
          {errors[f.id] && <span role="alert">{errors[f.id]}</span>}
        </li>
      ))}
    </ul>
  );
}
