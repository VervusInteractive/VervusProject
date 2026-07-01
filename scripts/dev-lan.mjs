import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";
import { mkdirSync, writeFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import process from "node:process";

const rootDir = process.cwd();
const clientDir = path.join(rootDir, "Client");
const serverDir = path.join(rootDir, "Server");
const clientPort = 5173;
const serverPort = 3001;

function isPrivateIpv4(address) {
  return (
    address.startsWith("192.168.") ||
    address.startsWith("10.") ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}

function getLanIp() {
  const interfaces = networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family !== "IPv4" || entry.internal) {
        continue;
      }

      if (isPrivateIpv4(entry.address)) {
        return entry.address;
      }
    }
  }

  throw new Error("Could not determine a private LAN IPv4 address for this machine.");
}

function prefixOutput(stream, label) {
  let pending = "";

  stream.on("data", (chunk) => {
    pending += chunk.toString();
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";

    for (const line of lines) {
      if (line.length > 0) {
        console.log(`[${label}] ${line}`);
      }
    }
  });

  stream.on("end", () => {
    if (pending.length > 0) {
      console.log(`[${label}] ${pending}`);
    }
  });
}

function startProcess(command, args, options) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...(options.env ?? {}) },
    shell: false,
    stdio: ["inherit", "pipe", "pipe"],
  });

  prefixOutput(child.stdout, options.label);
  prefixOutput(child.stderr, options.label);

  child.on("exit", (code, signal) => {
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.log(`[${options.label}] exited with ${reason}`);
  });

  return child;
}

function ensurePortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", (error) => {
      if (error.code === "EADDRINUSE") {
        reject(new Error(`Port ${port} is already in use. Stop the existing process and try again.`));
        return;
      }

      reject(error);
    });

    server.once("listening", () => {
      server.close(resolve);
    });

    server.listen(port, "0.0.0.0");
  });
}

const lanIp = getLanIp();
const clientUrl = `http://${lanIp}:${clientPort}`;
const serverUrl = `http://${lanIp}:${serverPort}`;

await ensurePortAvailable(serverPort);
await ensurePortAvailable(clientPort);

mkdirSync(clientDir, { recursive: true });
writeFileSync(
  path.join(clientDir, ".env.development.local"),
  `VITE_SERVER_URL=${serverUrl}\nVITE_CLIENT_URL=${clientUrl}\n`,
  "utf8",
);

console.log(`LAN client URL: ${clientUrl}`);
console.log(`LAN server URL: ${serverUrl}`);
console.log("Press Ctrl+C to stop both processes.");

const server = startProcess("npm.cmd", ["run", "dev"], {
  cwd: serverDir,
  env: {
    DATABASE_URL: "local-db-shim",
    PAYMENTS_REQUIRED: "false",
    CLIENT_URL: clientUrl,
    CORS_ORIGINS: `${clientUrl},http://localhost:${clientPort},http://127.0.0.1:${clientPort}`,
  },
  label: "server",
});

const client = startProcess("npm.cmd", ["run", "dev"], {
  cwd: clientDir,
  label: "client",
});

let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`Stopping dev servers (${signal})...`);
  server.kill(signal);
  client.kill(signal);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

Promise.all([
  new Promise((resolve) => server.on("exit", resolve)),
  new Promise((resolve) => client.on("exit", resolve)),
]).then(() => {
  process.exit(0);
});
