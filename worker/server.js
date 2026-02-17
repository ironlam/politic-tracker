/**
 * Poligraph Sync Worker
 *
 * Lightweight HTTP server that receives sync requests from the admin API
 * and executes sync scripts as child processes.
 *
 * Deployed on Fly.io Machines — starts on demand, shuts down after idle.
 *
 * Auth: Bearer token matching SYNC_WORKER_SECRET env var.
 * Routes:
 *   POST /sync/:script  — Start a sync script (body: { jobId })
 *   GET  /health        — Health check
 */

const http = require("http");
const { spawn } = require("child_process");
const { PrismaClient } = require("../src/generated/prisma");

const PORT = process.env.PORT || 3000;
const SECRET = process.env.SYNC_WORKER_SECRET;
const db = new PrismaClient();

// Track running processes
const running = new Map();

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function respond(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function handleSync(script, jobId, res) {
  if (running.has(script)) {
    return respond(res, 409, { error: "Script already running" });
  }

  // Update job status to RUNNING
  try {
    await db.syncJob.update({
      where: { id: jobId },
      data: { status: "RUNNING", startedAt: new Date() },
    });
  } catch (err) {
    console.error(`Failed to update job ${jobId}:`, err.message);
    return respond(res, 500, { error: "Failed to update job status" });
  }

  respond(res, 202, { status: "started", jobId });

  // Spawn the script
  const child = spawn("npx", ["tsx", `scripts/${script}.ts`], {
    cwd: process.cwd(),
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });

  running.set(script, child);

  let stdout = "";
  let stderr = "";

  child.stdout.on("data", (data) => {
    const text = data.toString();
    stdout += text;
    process.stdout.write(`[${script}] ${text}`);
  });

  child.stderr.on("data", (data) => {
    const text = data.toString();
    stderr += text;
    process.stderr.write(`[${script}] ${text}`);
  });

  child.on("close", async (code) => {
    running.delete(script);
    const completedAt = new Date();

    try {
      if (code === 0) {
        await db.syncJob.update({
          where: { id: jobId },
          data: {
            status: "COMPLETED",
            progress: 100,
            completedAt,
            result: { stdout: stdout.slice(-2000) },
          },
        });
        console.log(`[${script}] Completed successfully`);
      } else {
        await db.syncJob.update({
          where: { id: jobId },
          data: {
            status: "FAILED",
            completedAt,
            error: stderr.slice(-2000) || `Exit code ${code}`,
          },
        });
        console.error(`[${script}] Failed with exit code ${code}`);
      }
    } catch (err) {
      console.error(`Failed to update job ${jobId} after completion:`, err.message);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Health check
  if (req.method === "GET" && url.pathname === "/health") {
    return respond(res, 200, {
      status: "ok",
      running: Array.from(running.keys()),
    });
  }

  // Auth check
  const auth = req.headers.authorization;
  if (!SECRET || auth !== `Bearer ${SECRET}`) {
    return respond(res, 401, { error: "Unauthorized" });
  }

  // POST /sync/:script
  const syncMatch = url.pathname.match(/^\/sync\/([a-z0-9-]+)$/);
  if (req.method === "POST" && syncMatch) {
    const script = syncMatch[1];
    try {
      const body = await parseBody(req);
      if (!body.jobId) {
        return respond(res, 400, { error: "jobId required" });
      }
      return handleSync(script, body.jobId, res);
    } catch {
      return respond(res, 400, { error: "Invalid request body" });
    }
  }

  respond(res, 404, { error: "Not found" });
});

server.listen(PORT, () => {
  console.log(`Sync worker listening on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down...");
  for (const [script, child] of running) {
    console.log(`Killing ${script}...`);
    child.kill("SIGTERM");
  }
  server.close(() => {
    db.$disconnect().then(() => process.exit(0));
  });
});
