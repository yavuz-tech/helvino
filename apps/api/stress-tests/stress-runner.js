#!/usr/bin/env node
/**
 * Helvion Lightweight Stress Test Runner
 * - Zero dependencies (built-in http only)
 * - Runs with --max-old-space-size=256 (safe on 18GB machines)
 * - Measures: latency (avg/p50/p95/p99), throughput, error rate
 *
 * Usage:
 *   node stress-runner.js --url http://localhost:4000/health --conns 50 --duration 15
 *   node stress-runner.js --config tests.json
 *   node stress-runner.js --config tests.json --out results/
 */
const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Arg Parsing ─────────────────────────────────────────────
const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}

// ── Single Endpoint Test ────────────────────────────────────
function runTest({ url, method = "GET", body, headers = {}, conns, duration, label }) {
  return new Promise((resolve) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;
    const agent = new http.Agent({ keepAlive: true, maxSockets: conns });

    const latencies = [];
    let completed = 0;
    let errors = 0;
    let non2xx = 0;
    let inFlight = 0;
    let running = true;

    const startTime = Date.now();
    const endTime = startTime + duration * 1000;

    function sendRequest() {
      if (!running) return;
      inFlight++;
      const reqStart = Date.now();

      const opts = {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        method,
        agent,
        headers: { ...headers },
        timeout: 10000,
      };

      if (body) {
        opts.headers["Content-Type"] = opts.headers["Content-Type"] || "application/json";
        opts.headers["Content-Length"] = Buffer.byteLength(body);
      }

      const req = transport.request(opts, (res) => {
        // Drain body without buffering
        res.on("data", () => {});
        res.on("end", () => {
          const lat = Date.now() - reqStart;
          latencies.push(lat);
          completed++;
          if (res.statusCode < 200 || res.statusCode >= 300) non2xx++;
          inFlight--;
          if (running) sendRequest();
        });
      });

      req.on("error", () => {
        errors++;
        completed++;
        inFlight--;
        if (running) sendRequest();
      });

      req.on("timeout", () => {
        req.destroy();
        errors++;
        completed++;
        inFlight--;
        if (running) sendRequest();
      });

      if (body) req.write(body);
      req.end();
    }

    // Launch initial batch
    for (let i = 0; i < conns; i++) sendRequest();

    // Stop after duration
    const timer = setInterval(() => {
      if (Date.now() >= endTime) {
        running = false;
        clearInterval(timer);
        agent.destroy();

        // Wait for in-flight to drain (max 3s)
        const drainStart = Date.now();
        const drainInterval = setInterval(() => {
          if (inFlight <= 0 || Date.now() - drainStart > 3000) {
            clearInterval(drainInterval);
            finalize();
          }
        }, 100);
      }
    }, 200);

    function percentile(arr, p) {
      if (!arr.length) return 0;
      const sorted = arr.slice().sort((a, b) => a - b);
      const idx = Math.ceil(p / 100 * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    }

    function finalize() {
      const elapsed = (Date.now() - startTime) / 1000;
      const rps = completed / elapsed;
      const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
      const result = {
        label: label || url,
        url,
        connections: conns,
        duration: Math.round(elapsed),
        requests: { total: completed, perSecond: Math.round(rps) },
        latency: {
          average: +avg.toFixed(1),
          p50: percentile(latencies, 50),
          p95: percentile(latencies, 95),
          p99: percentile(latencies, 99),
          max: latencies.length ? Math.max(...latencies) : 0,
        },
        errors,
        non2xx,
        errorRate: completed > 0 ? +((errors + non2xx) / completed * 100).toFixed(2) : 0,
      };
      resolve(result);
    }
  });
}

// ── Config-based Multi-Test ─────────────────────────────────
async function runFromConfig(configPath, outDir) {
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const results = [];

  for (const test of config.tests) {
    // Health check before each test
    const alive = await checkHealth(config.baseUrl || "http://localhost:4000");
    if (!alive) {
      console.error(`  ❌ API down before "${test.label}", skipping`);
      results.push({ label: test.label, error: "api_down" });
      continue;
    }

    const url = (config.baseUrl || "http://localhost:4000") + test.path;
    console.log(`  ▶ ${test.label} — ${test.conns}c × ${test.duration}s → ${url}`);

    const result = await runTest({
      url,
      method: test.method || "GET",
      body: test.body ? JSON.stringify(test.body) : undefined,
      headers: test.headers || {},
      conns: test.conns,
      duration: test.duration,
      label: test.label,
    });

    results.push(result);
    const status = result.errorRate > 50 ? "❌" : result.latency.p95 > 500 ? "⚠️" : "✅";
    console.log(`    ${status} ${result.requests.total} reqs | ${result.requests.perSecond} rps | p95=${result.latency.p95}ms | err=${result.errorRate}%`);

    // Write individual result
    if (outDir) {
      const fname = test.label.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";
      fs.writeFileSync(path.join(outDir, fname), JSON.stringify(result, null, 2));
    }

    // Cooldown between tests
    await sleep(3000);
  }

  return results;
}

function checkHealth(baseUrl) {
  return new Promise((resolve) => {
    const req = http.get(baseUrl + "/health", { timeout: 5000 }, (res) => {
      res.on("data", () => {});
      res.on("end", () => resolve(res.statusCode === 200));
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
  });
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// ── Generate Markdown Report ────────────────────────────────
function generateReport(results, outDir) {
  let md = "# Helvion Stress Test Report\n\n";
  md += `**Date:** ${new Date().toISOString().replace("T", " ").slice(0, 19)}\n`;
  md += `**Machine:** ${process.arch}, Node ${process.version}\n`;
  md += `**Heap limit:** ${Math.round(require("v8").getHeapStatistics().heap_size_limit / 1024 / 1024)} MB\n\n`;
  md += "## Results\n\n";
  md += "| Test | Conns | Duration | Requests | Req/s | Avg(ms) | p50 | p95 | p99 | Max | Err% | Status |\n";
  md += "|------|-------|----------|----------|-------|---------|-----|-----|-----|-----|------|--------|\n";

  for (const r of results) {
    if (r.error) {
      md += `| ${r.label} | - | - | - | - | - | - | - | - | - | - | ❌ ${r.error} |\n`;
      continue;
    }
    let status = "✅ GEÇTI";
    if (r.errorRate > 50) status = "❌ PATLADI";
    else if (r.latency.p95 > 500 || r.errorRate > 10) status = "⚠️ YAVAŞ";

    md += `| ${r.label} | ${r.connections} | ${r.duration}s | ${r.requests.total} | ${r.requests.perSecond} | ${r.latency.average} | ${r.latency.p50} | ${r.latency.p95} | ${r.latency.p99} | ${r.latency.max} | ${r.errorRate}% | ${status} |\n`;
  }

  md += "\n---\n*Generated by stress-runner.js*\n";

  if (outDir) {
    fs.writeFileSync(path.join(outDir, "REPORT.md"), md);
  }
  return md;
}

// ── Main ────────────────────────────────────────────────────
async function main() {
  const configPath = arg("config", null);
  const outDir = arg("out", null);

  if (outDir) fs.mkdirSync(outDir, { recursive: true });

  if (configPath) {
    console.log("🔥 Helvion Stress Test (lightweight runner)");
    console.log(`   Heap limit: ${Math.round(require("v8").getHeapStatistics().heap_size_limit / 1024 / 1024)} MB`);
    console.log("");
    const results = await runFromConfig(configPath, outDir);
    const report = generateReport(results, outDir);
    console.log("\n" + report);
  } else {
    // Single URL mode
    const url = arg("url", "http://localhost:4000/health");
    const conns = parseInt(arg("conns", "10"));
    const duration = parseInt(arg("duration", "10"));
    console.log(`Testing ${url} — ${conns} connections × ${duration}s`);
    const result = await runTest({ url, conns, duration });
    console.log(JSON.stringify(result, null, 2));
    if (outDir) {
      fs.writeFileSync(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
    }
  }
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
