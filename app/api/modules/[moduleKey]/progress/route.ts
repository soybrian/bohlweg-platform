/**
 * API Route: /api/modules/[moduleKey]/progress
 *
 * GET: Server-Sent Events stream für Live-Progress-Updates
 */

import { NextRequest } from "next/server";
import {
  getProgress,
  addProgressListener,
  removeProgressListener,
  type ProgressUpdate,
} from "@/lib/progress-tracker";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ moduleKey: string }> }
) {
  const { moduleKey } = await params;

  const encoder = new TextEncoder();

  // Erstelle ReadableStream für SSE
  const stream = new ReadableStream({
    start(controller) {
      // Sende initialen Progress
      const currentProgress = getProgress(moduleKey);
      if (currentProgress) {
        const data = `data: ${JSON.stringify(currentProgress)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }

      // Listener für Updates
      const listener = (progress: ProgressUpdate) => {
        try {
          const data = `data: ${JSON.stringify(progress)}\n\n`;
          controller.enqueue(encoder.encode(data));

          // Schließe Stream wenn completed oder error
          if (progress.status === "completed" || progress.status === "error") {
            setTimeout(() => {
              try {
                controller.close();
              } catch (e) {
                // Controller already closed, ignore
              }
            }, 100);
          }
        } catch (e) {
          // Stream already closed, ignore
        }
      };

      addProgressListener(moduleKey, listener);

      // Cleanup bei Verbindungsabbruch
      request.signal.addEventListener("abort", () => {
        removeProgressListener(moduleKey, listener);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
