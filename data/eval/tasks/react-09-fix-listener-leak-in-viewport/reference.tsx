import { useEffect, useState } from "react";

function classify(width: number): "mobile" | "tablet" | "desktop" {
  if (width < 640) return "mobile";
  if (width < 1024) return "tablet";
  return "desktop";
}

export function ViewportBadge() {
  const [kind, setKind] = useState(() => classify(window.innerWidth));

  useEffect(() => {
    const onResize = () => setKind(classify(window.innerWidth));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return <span>{kind}</span>;
}
