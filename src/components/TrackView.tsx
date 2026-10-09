"use client";

import { useEffect } from "react";
import { track } from "@/lib/track";

export default function TrackView({ nome }: { nome: string }) {
  useEffect(() => {
    track(nome);
  }, [nome]);

  return null;
}
