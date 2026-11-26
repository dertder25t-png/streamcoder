import { useState } from "react";

export function TagChipsInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const [text, setText] = useState("");

  const commit = (raw: string) => {
    const tag = raw.trim();
    setText("");
    if (!tag) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
  };

  return (
    <div>
      {value.map((tag) => (
        <span key={tag}>
          {tag}
          <button type="button" aria-label={`Remove ${tag}`} onClick={() => onChange(value.filter((t) => t !== tag))}>
            x
          </button>
        </span>
      ))}
      <input
        type="text"
        value={text}
        onChange={(e) => {
          const v = e.target.value;
          if (v.includes(",")) commit(v.replace(/,/g, " "));
          else setText(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(text);
          } else if (e.key === "Backspace" && text === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />
    </div>
  );
}
