import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const DEFAULT_MAX_MS = 300_000;
const maxMs = Number(process.env.waitMaxDurationMs) || DEFAULT_MAX_MS;

const DIST_DIR = path.join(import.meta.dirname, "..");
const RESOURCE_URI = "ui://countdown/countdown-app.html";

const PAIRING_WINDOW_MS = 1500;

const schema = z.object({
  durationMs: z
    .number()
    .int()
    .min(1)
    .max(maxMs)
    .describe(`Total countdown time in ms. Max: ${maxMs}.`),
  reason: z.string().min(1).max(64).describe("Why the countdown is needed."),
});

type Session = {
  remaining: number;
  durationMs: number;
  paused: boolean;
  stopped: boolean;
  reason: string;
  pausePromise: Promise<void> | null;
  resumePause: (() => void) | null;
  createdAt: number;
  runCalled: boolean;
  readyPromise: Promise<void>;
  resolveReady: () => void;
};

const sessions = new Map<string, Session>();

export function register(server: McpServer): void {
  // Non-blocking: Just renders the UI with sessionId
  registerAppTool(
    server,
    "countdown",
    {
      title: "Countdown Timer",
      description:
        "Interactive countdown with pause/resume/stop controls. IMPORTANT: You MUST call both 'countdown' and 'countdown_run' tools simultaneously in the same request. If you call only one, it will fail.",
      inputSchema: schema.shape,
      _meta: { ui: { resourceUri: RESOURCE_URI } },
    },
    async (input) => {
      const { durationMs, reason } = input as z.infer<typeof schema>;
      const sessionId = crypto.randomUUID();

      let resolveReady!: () => void;
      const readyPromise = new Promise<void>((r) => {
        resolveReady = r;
      });

      sessions.set(sessionId, {
        remaining: durationMs,
        durationMs,
        paused: false,
        stopped: false,
        reason,
        pausePromise: null,
        resumePause: null,
        createdAt: Date.now(),
        runCalled: false,
        readyPromise,
        resolveReady,
      });

      // Wait for pairing window to check if countdown_run was called
      await new Promise((r) => setTimeout(r, PAIRING_WINDOW_MS + 50));

      const session = sessions.get(sessionId);
      if (!session?.runCalled) {
        sessions.delete(sessionId);
        return {
          content: [
            {
              type: "text",
              text: "ERROR: You must call both 'countdown' and 'countdown_run' tools SIMULTANEOUSLY in the same request. The countdown_run tool was not called within 500ms. Please try again, calling BOTH tools at the same time.",
            },
          ],
          isError: true,
        };
      }

      // Block until countdown_run signals it has started the timer loop
      await readyPromise;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ sessionId, durationMs, reason }),
          },
        ],
      };
    },
  );

  // Blocking: Runs the actual timer, returns when done
  server.tool(
    "countdown_run",
    "Start the countdown timer. Blocks until complete or stopped. IMPORTANT: You MUST call both 'countdown' and 'countdown_run' tools simultaneously. Pass the same durationMs and reason as countdown - the sessionId will be matched automatically.",
    {
      durationMs: z
        .number()
        .int()
        .min(1)
        .max(maxMs)
        .describe(`Total countdown time in ms. Max: ${maxMs}.`),
      reason: z
        .string()
        .min(1)
        .max(64)
        .describe("Same reason as countdown tool."),
    },
    async (input, extra) => {
      const { durationMs, reason } = input as {
        durationMs: number;
        reason: string;
      };

      // Find a session that matches durationMs and reason within the pairing window
      let matchedSessionId: string | null = null;
      let session: Session | null = null;
      const now = Date.now();

      for (const [id, s] of sessions) {
        if (
          s.durationMs === durationMs &&
          s.reason === reason &&
          !s.runCalled &&
          now - s.createdAt <= PAIRING_WINDOW_MS
        ) {
          matchedSessionId = id;
          session = s;
          break;
        }
      }

      if (!session || !matchedSessionId) {
        return {
          content: [
            {
              type: "text",
              text: "ERROR: You must call both 'countdown' and 'countdown_run' tools SIMULTANEOUSLY in the same request with matching durationMs and reason. No matching countdown session found within 500ms. Please try again, calling BOTH tools at the same time.",
            },
          ],
          isError: true,
        };
      }

      session.runCalled = true;

      // Signal countdown tool that the timer loop is ready — UI will now render
      session.resolveReady();

      const progressToken = extra._meta?.progressToken;
      const tickMs = 100;
      let lastReportedPct = -1;

      const sendProgress = async (remaining: number) => {
        if (progressToken === undefined) return;
        const elapsed = durationMs - remaining;
        const pct = Math.floor((elapsed / durationMs) * 100);
        if (pct === lastReportedPct) return;
        lastReportedPct = pct;
        const remainingSec = Math.max(0, Math.ceil(remaining / 1000));
        await extra.sendNotification({
          method: "notifications/progress",
          params: {
            progressToken,
            progress: elapsed,
            total: durationMs,
            message: `${remainingSec}s remaining`,
          },
        });
      };

      while (session.remaining > 0 && !session.stopped) {
        if (session.paused && session.pausePromise) {
          await session.pausePromise;
        }
        if (session.stopped) break;

        await new Promise((r) => setTimeout(r, tickMs));
        if (!session.paused) {
          session.remaining -= tickMs;
          await sendProgress(session.remaining);
        }
      }

      const elapsedMs = session.durationMs - Math.max(0, session.remaining);
      const status = session.stopped ? "stopped" : "complete";
      sessions.delete(matchedSessionId);

      return {
        content: [
          {
            type: "text",
            text: `Countdown ${status}. Elapsed: ${elapsedMs}ms.`,
          },
        ],
      };
    },
  );

  server.tool(
    "countdown_pause",
    "Pause or resume an active countdown.",
    { sessionId: z.string().describe("Session ID from countdown tool.") },
    async (input) => {
      const { sessionId } = input as { sessionId: string };
      const session = sessions.get(sessionId);
      if (!session) {
        return {
          content: [{ type: "text", text: "Session not found." }],
          isError: true,
        };
      }

      if (session.paused) {
        session.paused = false;
        session.resumePause?.();
        session.pausePromise = null;
        session.resumePause = null;
        return { content: [{ type: "text", text: "Resumed." }] };
      } else {
        session.paused = true;
        session.pausePromise = new Promise<void>((r) => {
          session.resumePause = r;
        });
        return { content: [{ type: "text", text: "Paused." }] };
      }
    },
  );

  server.tool(
    "countdown_stop",
    "Stop an active countdown immediately.",
    { sessionId: z.string().describe("Session ID from countdown tool.") },
    async (input) => {
      const { sessionId } = input as { sessionId: string };
      const session = sessions.get(sessionId);
      if (!session) {
        return {
          content: [{ type: "text", text: "Session not found." }],
          isError: true,
        };
      }

      session.stopped = true;
      session.resumePause?.();
      return { content: [{ type: "text", text: "Stopped." }] };
    },
  );

  server.tool(
    "countdown_status",
    "Get the current status of a countdown session.",
    { sessionId: z.string().describe("Session ID from countdown tool.") },
    async (input) => {
      const { sessionId } = input as { sessionId: string };
      const session = sessions.get(sessionId);
      if (!session) {
        return {
          content: [{ type: "text", text: JSON.stringify({ active: false }) }],
        };
      }
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              active: true,
              remaining: session.remaining,
              paused: session.paused,
              reason: session.reason,
            }),
          },
        ],
      };
    },
  );

  registerAppResource(
    server,
    RESOURCE_URI,
    RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    async () => {
      const html = await fs.readFile(
        path.join(DIST_DIR, "countdown-app.html"),
        "utf-8",
      );
      return {
        contents: [
          { uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: html },
        ],
      };
    },
  );
}
