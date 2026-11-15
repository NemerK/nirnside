"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Scales its contents down so the block stays inside the space the parent
 * already has. The parent must have a bounded height.
 */
export function FitScreen({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const frameEl = frame.current;
    const bodyEl = body.current;
    if (!frameEl || !bodyEl) return;

    const fit = () => {
      const avail = frameEl.clientHeight;
      const width = frameEl.clientWidth;
      if (avail < 8 || width < 8) return;
      bodyEl.style.transform = "none";
      bodyEl.style.width = `${width}px`;
      const atFrame = bodyEl.offsetHeight;
      let scale = atFrame > 0 ? Math.min(1, avail / atFrame) : 1;
      if (scale < 1) {
        bodyEl.style.width = `${width / scale}px`;
        const wider = bodyEl.offsetHeight;
        scale = wider > 0 ? Math.min(1, avail / wider) : 1;
      }
      bodyEl.style.width = `${width / scale}px`;
      bodyEl.style.transform = `scale(${scale})`;
      bodyEl.style.transformOrigin = "top left";
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(frameEl);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={frame} className="h-full min-h-0 overflow-hidden">
      <div ref={body}>{children}</div>
    </div>
  );
}
