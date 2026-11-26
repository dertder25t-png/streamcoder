import { useState } from "react";

export function SwitchControl({
  checked,
  defaultChecked,
  onChange,
}: {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (next: boolean) => void;
}) {
  const [inner, setInner] = useState(defaultChecked ?? false);
  const isControlled = checked !== undefined;
  const current = isControlled ? checked : inner;

  const toggle = () => {
    const next = !current;
    if (!isControlled) setInner(next);
    onChange?.(next);
  };

  return (
    <button type="button" role="switch" aria-checked={current} onClick={toggle}>
      {current ? "On" : "Off"}
    </button>
  );
}
