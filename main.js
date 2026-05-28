/**
 * Personal Agent — Electron thin shell.
 * Spawns wgnr-pi backend, waits for it, then opens the web UI in a window.
 */
const { app, BrowserWindow, Tray, Menu, nativeImage } = require("electron");
const { spawn, execSync } = require("child_process");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

const PORT = 4815;
const URL = `http://127.0.0.1:${PORT}`;

let mainWindow = null;
let tray = null;
let serverProc = null;
let isQuitting = false;

// ── Diagnostic logging ──────────────────────────────────────
const LOG_DIR = path.join(os.homedir(), ".personal-agent", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const MAIN_LOG = path.join(LOG_DIR, `pa-main-${Date.now()}.log`);
const logStream = fs.createWriteStream(MAIN_LOG, { flags: "a" });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logStream.write(line + "\n");
}
function logErr(msg) {
  const line = `[${new Date().toISOString()}] ERROR: ${msg}`;
  console.error(line);
  logStream.write(line + "\n");
}
process.on("uncaughtException", (err) => { logErr(`UNCAUGHT: ${err.message}\n${err.stack}`); });
process.on("unhandledRejection", (reason) => { logErr(`UNHANDLED: ${reason}`); });

// ── Port cleanup ───────────────────────────────────────────
function killExistingPort() {
  try {
    const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: "utf8", timeout: 3000 });
    const lines = out.trim().split(/\r?\n/);
    const seen = new Set();
    for (const line of lines) {
      const m = line.match(/\s+(\d+)\s*$/);
      if (m && !seen.has(m[1])) {
        seen.add(m[1]);
        try { execSync(`taskkill /PID ${m[1]} /F /T`, { timeout: 3000 }); } catch {}
      }
    }
    if (seen.size > 0) log(`Cleaned up ${seen.size} process(es) holding port ${PORT}`);
  } catch {}
}

// ── Backend ───────────────────────────────────────────────────

function startBackend() {
  killExistingPort();

  // stdout and stderr go directly to logStream, avoiding pipe buffer backpressure
  // Use local wgnr-pi (not global) so server.js is modifiable
  const serverScript = path.join(__dirname, "vendor", "wgnr-pi", "server.js");
  serverProc = spawn("node", [serverScript], {
    cwd: __dirname,
    env: {
      ...process.env,
      WGPI_CWD: __dirname,
      WGPI_PORT: String(PORT),
      WGPI_PI_BIN: "pi-node.cmd",
    },
    stdio: ["pipe", logStream, logStream],
    shell: true,
  });

  serverProc.on("error", (err) => logErr(`wgnr-pi spawn error: ${err.message}`));
  serverProc.on("exit", (code, signal) => {
    log(`wgnr-pi exited with code ${code}, signal ${signal}`);
    serverProc = null;
  });
}

function waitForServer(retries = 50, interval = 500) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const check = () => {
      // Abort if server process died
      if (serverProc && serverProc.exitCode != null) {
        logErr(`Server exited prematurely (code ${serverProc.exitCode}), aborting wait`);
        return reject(new Error(`Server exited with code ${serverProc.exitCode}`));
      }
      http.get(URL, (res) => {
        if (res.statusCode === 200) {
          setTimeout(resolve, 1500);
        } else if (++n < retries) setTimeout(check, interval);
      }).on("error", () => {
        if (++n < retries) setTimeout(check, interval);
        else logErr("Server did not start after " + retries + " retries");
      });
    };
    check();
  });
}

// ── Window ────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 500,
    title: "Personal Agent",
    backgroundColor: "#1a1a2e",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.loadURL(URL);

  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.once("page-title-updated", () => mainWindow.setTitle("Personal Agent"));

  mainWindow.webContents.on("before-input-event", (_e, input) => {
    if (input.key === "F12") {
      mainWindow.webContents.toggleDevTools();
    }
    if (input.control && input.shift && input.key === "I") {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
    }
  });
}

// ── Tray ──────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip("Personal Agent");

  const menu = Menu.buildFromTemplate([
    { label: "显示窗口", click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { type: "separator" },
    { label: "退出", click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(menu);
  tray.on("click", () => {
    if (mainWindow?.isVisible()) mainWindow.hide();
    else { mainWindow?.show(); mainWindow?.focus(); }
  });
}

// ── Lifecycle ─────────────────────────────────────────────────

app.whenReady().then(async () => {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: "File",
      submenu: [
        { label: "DevTools", accelerator: "F12", click: () => mainWindow?.webContents.toggleDevTools() },
        { type: "separator" },
        { role: "quit", label: "退出" },
      ],
    },
  ]));

  startBackend();
  try {
    await waitForServer();
  } catch (e) {
    logErr("Failed to start server: " + e.message);
    app.quit();
    return;
  }
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProc && !serverProc.killed) serverProc.kill();
});

app.on("window-all-closed", () => {}); // stay in tray
