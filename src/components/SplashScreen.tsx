import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import crowforgeLogo from "../assets/crowforge_ico.png";

const STATUS_MESSAGES = [
  "Starting backend…",
  "Almost ready…",
  "Hang tight…",
  "First launch may take a moment…",
  "Still loading, please wait…",
];

export function SplashScreen({ failed }: { failed?: boolean }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (failed) return;
    const id = setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2500);
    return () => clearInterval(id);
  }, [failed]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-background text-foreground">
      <img src={crowforgeLogo} alt="CrowForge" className="h-20 w-20 rounded-2xl shadow-lg" />
      <span className="text-2xl font-bold tracking-tight">CrowForge</span>

      {failed ? (
        <div className="text-center space-y-1">
          <p className="text-sm font-medium text-destructive">Backend failed to start</p>
          <p className="text-xs text-muted-foreground">
            Try running{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-[11px]">python -m backend.app</code>{" "}
            manually.
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{STATUS_MESSAGES[msgIndex]}</p>
        </div>
      )}
    </div>
  );
}
