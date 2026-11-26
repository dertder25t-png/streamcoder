import { useState } from "react";

export function LimitedTextArea({
  maxLength,
  warnAt,
  onSubmit,
}: {
  maxLength: number;
  warnAt: number;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const remaining = maxLength - value.length;
  const state = remaining < 0 ? "error" : remaining <= warnAt ? "warning" : "ok";
  const disabled = value.trim() === "" || value.length > maxLength;
  return (
    <div>
      <textarea value={value} onChange={(e) => setValue(e.target.value)} />
      <span data-state={state}>{remaining} characters left</span>
      <button disabled={disabled} onClick={() => onSubmit(value)}>
        Submit
      </button>
    </div>
  );
}
