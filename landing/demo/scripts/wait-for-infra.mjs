import { setTimeout as sleep } from "node:timers/promises";
const checks = [
  { name: "postgres", url: null, tcp: { host: "localhost", port: 5433 } },
  { name: "redis", url: null, tcp: { host: "localhost", port: 6380 } },
  { name: "localstack", url: "http://localhost:4566/_localstack/health" },
];
async function tcpOpen({ host, port }) {
  const net = await import("node:net");
  return new Promise((res) => {
    const s = net.createConnection({ host, port }, () => { s.end(); res(true); });
    s.on("error", () => res(false));
  });
}
async function httpOk(url) {
  try { const r = await fetch(url); return r.ok; } catch { return false; }
}
const deadline = Date.now() + 60_000;
for (const c of checks) {
  process.stdout.write(`[wait] ${c.name}…`);
  while (Date.now() < deadline) {
    const ok = c.url ? await httpOk(c.url) : await tcpOpen(c.tcp);
    if (ok) { console.log(" ok"); break; }
    await sleep(500);
  }
  if (Date.now() >= deadline) { console.error(`\n[wait] ${c.name} TIMEOUT`); process.exit(1); }
}
console.log("[wait] all services healthy");
