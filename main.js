/**
 * Personal Agent — Electron thin shell.
 * Spawns wgnr-pi backend, waits for it, then opens the web UI in a window.
 */
const { app, BrowserWindow, Tray, Menu, nativeImage } = require("electron");
const { spawn } = require("child_process");
const http = require("http");

const PORT = 4815;
const URL = `http://127.0.0.1:${PORT}`;

let mainWindow = null;
let tray = null;
let serverProc = null;
let isQuitting = false;

// ── Backend ───────────────────────────────────────────────────

function startBackend() {
  serverProc = spawn("wgnr-pi", [], {
    cwd: __dirname,
    env: {
      ...process.env,
      WGPI_CWD: __dirname,
      WGPI_PORT: String(PORT),
      WGPI_PI_BIN: "pi-node.cmd",
    },
    stdio: "ignore",
    shell: true,
  });

  serverProc.on("error", (err) => console.error("wgnr-pi error:", err.message));
}

function waitForServer(retries = 50, interval = 500) {
  return new Promise((resolve) => {
    let n = 0;
    const check = () => {
      http.get(URL, (res) => {
        if (res.statusCode === 200) {
          // Give the WebSocket server a moment to initialize
          setTimeout(resolve, 1500);
        } else if (++n < retries) setTimeout(check, interval);
      }).on("error", () => {
        if (++n < retries) setTimeout(check, interval);
        else console.error("Server did not start");
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
  // Register F12 via menu accelerator (more reliable than before-input-event)
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
  await waitForServer();
  createWindow();
  createTray();
});

app.on("before-quit", () => {
  isQuitting = true;
  if (serverProc && !serverProc.killed) serverProc.kill();
});

app.on("window-all-closed", () => {}); // stay in tray
