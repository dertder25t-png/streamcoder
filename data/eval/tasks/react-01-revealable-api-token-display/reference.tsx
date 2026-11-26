import { useEffect, useRef, useState } from "react";

export function RevealableToken({ token }: { token: string }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setRevealed(false), [token]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!token) return <p>No token provided</p>;

  const copy = async () => {
    await navigator.clipboard.writeText(token);
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <code>{revealed ? token : "•".repeat(token.length)}</code>
      <button onClick={() => setRevealed((r) => !r)}>{revealed ? "Hide" : "Show"}</button>
      <button onClick={copy}>Copy</button>
      {copied && <span>Copied</span>}
    </div>
  );
}
