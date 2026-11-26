import { useState, type FormEvent } from "react";

type Values = { startDate: string; endDate: string; label: string };

function validate(v: Values) {
  const e: Partial<Record<keyof Values, string>> = {};
  if (!v.startDate) e.startDate = "Start date is required";
  if (!v.endDate) e.endDate = "End date is required";
  else if (v.startDate && v.endDate < v.startDate) e.endDate = "End date must not be before start date";
  if (!v.label.trim()) e.label = "Label is required";
  return e;
}

export function DateRangeForm({ onSubmit }: { onSubmit: (v: Values) => void }) {
  const [v, setV] = useState<Values>({ startDate: "", endDate: "", label: "" });
  const [touched, setTouched] = useState<Partial<Record<keyof Values, boolean>>>({});
  const errors = validate(v);
  const show = (k: keyof Values) => (touched[k] ? errors[k] : undefined);
  const refs: Record<string, HTMLInputElement | null> = {};

  const field = (k: keyof Values, label: string, type: string) => (
    <div>
      <label htmlFor={`f-${k}`}>{label}</label>
      <input
        id={`f-${k}`}
        type={type}
        value={v[k]}
        ref={(el) => {
          refs[k] = el;
        }}
        aria-invalid={show(k) ? true : undefined}
        aria-describedby={show(k) ? `e-${k}` : undefined}
        onChange={(e) => setV({ ...v, [k]: e.target.value })}
        onBlur={() => setTouched({ ...touched, [k]: true })}
      />
      {show(k) && <span id={`e-${k}`}>{errors[k]}</span>}
    </div>
  );

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setTouched({ startDate: true, endDate: true, label: true });
    const first = (["startDate", "endDate", "label"] as const).find((k) => errors[k]);
    if (first) {
      const el = document.getElementById(`f-${first}`);
      el?.focus();
      return;
    }
    onSubmit(v);
  };

  return (
    <form onSubmit={submit} noValidate>
      {field("startDate", "Start date", "date")}
      {field("endDate", "End date", "date")}
      {field("label", "Label", "text")}
      <button type="submit">Submit</button>
    </form>
  );
}
