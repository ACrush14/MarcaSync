"use client";

import { useEffect, useRef } from "react";
import type { RiskTier } from "@/lib/types";

interface WaveCanvasProps {
  fa: string;
  fb: string;
  tier: RiskTier;
}

function bars(str: string, n: number): number[] {
  const codes = str.length ? str : "x";
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const c = codes.charCodeAt(i % codes.length);
    out.push(8 + (c % 43)); // 8..50
  }
  return out;
}

export default function WaveCanvas({ fa, fb, tier }: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssColor = (name: string) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim();

    const draw = () => {
      const accent = cssColor("--accent");
      const matchColor = cssColor(
        tier.cls === "safe" ? "--safe" : tier.cls === "warm" ? "--warm" : "--risk"
      );
      const W = canvas.width;
      const H = canvas.height;
      const mid = H / 2;
      ctx.clearRect(0, 0, W, H);

      const n = 44;
      const a = bars(fa, n);
      const b = bars(fb, n);
      const gap = W / n;
      const barW = gap * 0.34;

      ctx.globalAlpha = 0.9;
      for (let i = 0; i < n; i++) {
        const x = i * gap + gap * 0.18;
        const h = (a[i] ?? 8) * 1.4;
        ctx.fillStyle = accent;
        ctx.fillRect(x, mid - h, barW, h);
      }
      ctx.globalAlpha = 0.75;
      for (let i = 0; i < n; i++) {
        const x = i * gap + gap * 0.48;
        const h = (b[i] ?? 8) * 1.4;
        ctx.fillStyle = matchColor;
        ctx.fillRect(x, mid, barW, h);
      }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cssColor("--border");
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, mid);
      ctx.lineTo(W, mid);
      ctx.stroke();
    };

    draw();

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", draw);
    return () => mq.removeEventListener("change", draw);
  }, [fa, fb, tier]);

  return <canvas id="wave" ref={canvasRef} width={1000} height={200} />;
}
