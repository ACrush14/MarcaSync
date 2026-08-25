"use client";

import { useEffect, useState } from "react";

const ITEMS = [
  "Consultando base de marcas do INPI",
  "Aplicando algoritmo de colidência fonética",
  "Inferindo classe NCL pela descrição",
  "Cruzando com publicações recentes da RPI",
];

interface LoadingStepProps {
  marca: string;
  onDone: () => void;
}

export default function LoadingStep({ marca, onDone }: LoadingStepProps) {
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const step = reduced ? 0 : 480;

    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= ITEMS.length; i++) {
      timers.push(setTimeout(() => setActiveCount(i), step * i));
    }
    timers.push(setTimeout(onDone, step * ITEMS.length + (reduced ? 0 : 400)));

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="loading-wrap">
      <h3>Analisando &quot;{marca}&quot;…</h3>
      <div className="checklist">
        {ITEMS.map((text, i) => (
          <div key={text} className={`check-item ${i < activeCount ? "active" : ""}`}>
            <span className="check-dot" />
            <span>{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
