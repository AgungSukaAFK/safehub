// Klien Chrome DevTools Protocol minimal (Node 22+: WebSocket bawaan, tanpa dependensi).
// Dipakai scripts/qa/qa.mjs. Chrome dicari di lokasi umum atau env CHROME.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ].filter(Boolean);
  const hit = candidates.find((c) => fs.existsSync(c));
  if (!hit) throw new Error("Chrome tidak ditemukan. Set env CHROME=<path chrome>.");
  return hit;
}

export async function launch({ port = 9333 } = {}) {
  // profil di tmp biasa (CacheStorage gagal di folder yang aksesnya dibatasi)
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lourdes-qa-"));
  const proc = spawn(findChrome(), ["--headless=new", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check", "--window-size=1280,900", "about:blank"], {
    stdio: "ignore",
  });
  let ver;
  for (let i = 0; i < 60 && !ver; i++) {
    try {
      ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    } catch {
      await sleep(200);
    }
  }
  if (!ver) throw new Error("Chrome tidak bisa dijalankan");
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let seq = 0;
  const pending = new Map();
  const listeners = new Set();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(new Error(msg.error.message));
      else res(msg.result);
    } else listeners.forEach((l) => l(msg));
  };
  const send = (method, params = {}, sessionId) =>
    new Promise((res, rej) => {
      const id = ++seq;
      pending.set(id, { res, rej });
      ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  const on = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  const waitFor = (pred, timeout = 60000) =>
    new Promise((res, rej) => {
      const off = on((m) => {
        if (pred(m)) {
          off();
          clearTimeout(t);
          res(m);
        }
      });
      const t = setTimeout(() => {
        off();
        rej(new Error("timeout menunggu event"));
      }, timeout);
    });

  async function newPage() {
    const { targetId } = await send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
    const s = (m, p) => send(m, p, sessionId);
    await Promise.all([s("Page.enable"), s("Runtime.enable"), s("Network.enable")]);
    const errors = [];
    on((m) => {
      if (m.sessionId !== sessionId) return;
      if (m.method === "Runtime.exceptionThrown") errors.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || "").split("\n")[0]);
      // dialog "tinggalkan halaman?" diterima otomatis
      if (m.method === "Page.javascriptDialogOpening") s("Page.handleJavaScriptDialog", { accept: true }).catch(() => {});
    });
    const page = {
      sessionId,
      send: s,
      errors,
      async goto(url, timeout = 60000) {
        const done = waitFor((m) => m.sessionId === sessionId && m.method === "Page.loadEventFired", timeout);
        await s("Page.navigate", { url });
        await done;
      },
      async eval(expression, timeout = 15000) {
        const r = await Promise.race([
          s("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }),
          sleep(timeout).then(() => {
            throw new Error("eval timeout: " + expression.slice(0, 80));
          }),
        ]);
        if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
        return r.result.value;
      },
      text: () => page.eval("document.body.innerText"),
      async waitText(str, timeout = 15000) {
        const end = Date.now() + timeout;
        while (Date.now() < end) {
          if ((await page.text().catch(() => "")).includes(str)) return true;
          await sleep(250);
        }
        return false;
      },
      async viewport(width, height = 900, { mobile = false, touch = false } = {}) {
        await s("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile });
        await s("Emulation.setTouchEmulationEnabled", { enabled: touch, maxTouchPoints: touch ? 5 : 1 });
      },
      async screenshot(file) {
        const { data } = await s("Page.captureScreenshot", { format: "png" });
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, Buffer.from(data, "base64"));
        return file;
      },
    };
    return page;
  }

  const swSessions = new Map();
  /** Emulasi offline untuk tab DAN service worker (emulasi berlaku per sesi: sesi worker dipakai ulang). */
  async function setOffline(page, offline) {
    const cond = { offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
    await page.send("Network.emulateNetworkConditions", cond);
    const { targetInfos } = await send("Target.getTargets");
    for (const t of targetInfos.filter((x) => x.type === "service_worker")) {
      let sid = swSessions.get(t.targetId);
      if (!sid) {
        sid = (await send("Target.attachToTarget", { targetId: t.targetId, flatten: true })).sessionId;
        swSessions.set(t.targetId, sid);
        await send("Network.enable", {}, sid).catch(() => {});
      }
      await send("Network.emulateNetworkConditions", cond, sid).catch(() => {});
    }
  }

  async function close() {
    await send("Browser.close").catch(() => {});
    proc.kill();
    await sleep(500);
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3 });
  }

  return { send, on, waitFor, newPage, setOffline, close };
}
