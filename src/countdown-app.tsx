import { useApp } from "@modelcontextprotocol/ext-apps/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

interface InitData {
  sessionId: string;
  durationMs: number;
  reason: string;
}

interface StatusResult {
  active: boolean;
  remaining?: number;
  paused?: boolean;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

type TimerState = "running" | "paused" | "complete" | "stopped";

function CountdownApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [reason, setReason] = useState("");
  const [timerState, setTimerState] = useState<TimerState>("running");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { app, isConnected } = useApp({
    appInfo: { name: "Countdown Timer", version: "1.0.0" },
    capabilities: {},
    onAppCreated: (instance) => {
      instance.ontoolresult = (result) => {
        const content = result.content?.find((c) => c.type === "text");
        if (!content || !("text" in content)) return;
        try {
          const data = JSON.parse(content.text) as InitData;
          setSessionId(data.sessionId);
          setRemaining(data.durationMs);
          setReason(data.reason);
        } catch {
          if (content.text.includes("complete")) setTimerState("complete");
          else if (content.text.includes("stopped")) setTimerState("stopped");
        }
      };
    },
  });

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!app || !sessionId) return;

    const poll = async () => {
      try {
        const result = await app.callServerTool({
          name: "countdown_status",
          arguments: { sessionId },
        });
        const content = result.content?.find((c) => c.type === "text");
        if (!content || !("text" in content)) return;
        const status = JSON.parse(content.text) as StatusResult;
        if (!status.active) {
          stopPolling();
          setTimerState("complete");
        } else {
          setRemaining(status.remaining ?? 0);
          setTimerState(status.paused ? "paused" : "running");
        }
      } catch {
        // Ignore poll errors
      }
    };

    pollRef.current = setInterval(poll, 200);
    poll();
    return stopPolling;
  }, [app, sessionId, stopPolling]);

  const handlePause = async () => {
    if (!app || !sessionId) return;
    await app.callServerTool({ name: "countdown_pause", arguments: { sessionId } });
  };

  const handleStop = async () => {
    if (!app || !sessionId) return;
    stopPolling();
    setTimerState("stopped");
    await app.callServerTool({ name: "countdown_stop", arguments: { sessionId } });
  };

  // Render nothing until connected AND session data is ready — keeps iframe at zero height
  if (!isConnected || !sessionId) {
    document.body.style.cssText = "margin:0;padding:0;height:0;overflow:hidden;";
    return null;
  }

  document.body.style.cssText = "margin:0;padding:0;";

  const isDone = timerState === "complete" || timerState === "stopped";

  return (
    <div style={styles.container}>
      <div
        style={{
          ...styles.timer,
          color:
            timerState === "complete"
              ? "#4ec9b0"
              : timerState === "stopped"
                ? "#ce9178"
                : "#d4d4d4",
        }}
      >
        {timerState === "complete"
          ? "Done!"
          : timerState === "stopped"
            ? "Stopped"
            : formatTime(remaining)}
      </div>
      {!isDone && (
        <div style={styles.buttons}>
          <button style={styles.btn} onClick={handlePause}>
            {timerState === "paused" ? "Resume" : "Pause"}
          </button>
          <button style={styles.btn} onClick={handleStop}>
            Stop
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    background: "#1e1e1e",
    color: "#d4d4d4",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: "1.5vh",
    padding: "2vh 4vw",
  },
  timer: {
    fontSize: "clamp(2rem, 8vw, 5rem)",
    fontWeight: "bold",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  reason: {
    fontSize: "clamp(0.75rem, 2vw, 1rem)",
    color: "#888",
  },
  buttons: {
    display: "flex",
    gap: "2vw",
  },
  btn: {
    background: "#3c3c3c",
    color: "#d4d4d4",
    border: "none",
    padding: "1vh 3vw",
    fontSize: "clamp(0.8rem, 2vw, 1rem)",
    borderRadius: "6px",
    cursor: "pointer",
  },
} as const;

const root = createRoot(document.getElementById("root")!);
root.render(<CountdownApp />);
