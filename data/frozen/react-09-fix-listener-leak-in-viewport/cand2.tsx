import { useState, useEffect } from "react";

export function ViewportBadge() {
  const [kind, setKind] = useState("desktop");

  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w <= 640) setKind("mobile");
      else if (w <= 1024) setKind("tablet");
      else setKind("desktop");
    };

    handleResize(); // Initialize on mount
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize); // Clean up on unmount
    };
  }, []);

  return <span>{kind}</span>;
}
