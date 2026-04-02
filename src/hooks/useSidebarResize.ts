import { useState, useRef, useEffect } from "react";

export function useSidebarResize(min = 160, max = 400, initial = 220) {
  const [sidebarWidth, setSidebarWidth] = useState(initial);
  const resizing = useRef(false);
  const resizeStart = useRef(0);
  const widthStart = useRef(initial);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      setSidebarWidth(Math.max(min, Math.min(max, widthStart.current + e.clientX - resizeStart.current)));
    };
    const onUp = () => { resizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [min, max]);

  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizing.current = true;
    resizeStart.current = e.clientX;
    widthStart.current = sidebarWidth;
  };

  return { sidebarWidth, onResizeStart };
}
