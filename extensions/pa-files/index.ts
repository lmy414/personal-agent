/**
 * pa-files — Workspace file browser + preview for Personal Agent.
 * Registers /files, /preview, /workspace commands and LLM-callable tools.
 */
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@mariozechner/pi-ai";
import { defineTool } from "@mariozechner/pi-coding-agent";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { getDB } from "../../bridge/db";

// ── State ──────────────────────────────────────────────────────

let workspaceRoot = process.cwd();

const ALLOWED_ROOTS = [process.cwd(), path.join(os.homedir(), "Documents")];

/** 从 SQLite 读取用户设置的工作目录，fallback 到运行时 workspaceRoot */
function getWorkspaceRoot(): string {
  try {
    const db = getDB()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'work_dir'").get() as { value: string } | undefined
    if (row?.value && fs.existsSync(row.value) && fs.statSync(row.value).isDirectory()) {
      return row.value
    }
  } catch { /* DB 未就绪 */ }
  return workspaceRoot
}

function isAllowedRoot(dir: string): boolean {
  const roots = [...ALLOWED_ROOTS, getWorkspaceRoot()]
  return roots.some((r) => {
    const rel = path.relative(r, dir);
    return !rel.startsWith("..") && !path.isAbsolute(rel);
  });
}

function resolveSafe(filePath: string): string | null {
  const root = getWorkspaceRoot()
  const target = path.resolve(root, filePath);
  const rel = path.relative(root, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return target;
}

// ── File listing ───────────────────────────────────────────────

function listDir(dirPath: string, depth = 0, maxDepth = 2): string[] {
  const lines: string[] = [];
  if (depth > maxDepth) return lines;

  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { return lines; }

  const sorted = entries.sort((a, b) => {
    if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const indent = "  ".repeat(depth);
  for (const entry of sorted) {
    // skip hidden/ignored
    if (entry.name.startsWith(".") && entry.name !== ".pi") continue;
    if (["node_modules", "__pycache__", ".git"].includes(entry.name)) continue;

    if (entry.isDirectory()) {
      lines.push(`${indent}📁 ${entry.name}/`);
      lines.push(...listDir(path.join(dirPath, entry.name), depth + 1, maxDepth));
    } else {
      let size = "";
      try {
        size = formatSize(fs.statSync(path.join(dirPath, entry.name)).size);
      } catch { size = "?"; }
      lines.push(`${indent}📄 ${entry.name}  ${size}`);
      if (lines.length > 200) { lines.push(`${indent}... (truncated)`); return lines; }
    }
  }
  return lines;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// ── File preview ──────────────────────────────────────────────

function previewFile(filePath: string): string {
  let content: string;
  try { content = fs.readFileSync(filePath, "utf-8"); } catch { return "[Error: cannot read file]"; }
  if (content.length > 8000) content = content.slice(0, 8000) + "\n\n... (truncated)";

  const ext = path.extname(filePath).toLowerCase();
  const binaryExts = [".jpg", ".png", ".gif", ".pdf", ".exe", ".dll", ".obj", ".bat", ".cmd", ".ps1", ".vbs", ".js", ".wsf", ".scr", ".com", ".msi", ".reg", ".zip", ".rar", ".7z"];
  if (ext === ".md") return content;
  if (ext === ".html") return stripHtmlTags(content);
  if (binaryExts.includes(ext)) {
    return `[Binary file: ${ext} — ${formatSize(fs.statSync(filePath).size)}]`;
  }
  return content;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ").replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── LLM-callable tools ─────────────────────────────────────────

const listDirTool = defineTool({
  name: "list_directory",
  label: "List Directory",
  description: "List contents of a directory under the current workspace. Use \".\" for root.",
  parameters: Type.Object({
    dir_path: Type.String({ description: "Directory path relative to workspace, or '.' for root" }),
  }),
  execute: async (_id, params) => {
    const root = getWorkspaceRoot()
    const target = params.dir_path === "." ? root : resolveSafe(params.dir_path);
    if (!target) return { content: [{ type: "text", text: "Access denied: path outside workspace" }], details: {} };
    const lines = listDir(target, 0, 3);
    return { content: [{ type: "text", text: lines.join("\n") || "(empty)" }], details: { path: target } };
  },
});

const previewFileTool = defineTool({
  name: "preview_file",
  label: "Preview File",
  description: "Read and preview a file under the current workspace. Supports Markdown, HTML, code, and text files.",
  parameters: Type.Object({
    file_path: Type.String({ description: "File path relative to workspace" }),
  }),
  execute: async (_id, params) => {
    const target = resolveSafe(params.file_path);
    if (!target) return { content: [{ type: "text", text: "Access denied: path outside workspace" }], details: {} };
    if (!fs.existsSync(target)) return { content: [{ type: "text", text: `File not found: ${params.file_path}` }], details: {} };
    const stat = fs.statSync(target);
    if (stat.isDirectory()) {
      const lines = listDir(target, 0, 2);
      return { content: [{ type: "text", text: lines.join("\n") }], details: { path: target, isDir: true } };
    }
    const content = previewFile(target);
    return { content: [{ type: "text", text: content }], details: { path: target, size: stat.size } };
  },
});

// ── Extension ──────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerTool(listDirTool);
  pi.registerTool(previewFileTool);

  // /files [path] — browse workspace
  pi.registerCommand("files", {
    description: "Browse workspace directory tree (usage: /files [subdir])",
    handler: async (args, ctx) => {
      const root = getWorkspaceRoot()
      const target = args.trim() ? resolveSafe(args.trim()) : root;
      if (!target) { ctx.ui.notify("Path outside workspace", "warning"); return; }
      if (!fs.existsSync(target)) { ctx.ui.notify(`Not found: ${args.trim()}`, "warning"); return; }
      const stat = fs.statSync(target);
      if (!stat.isDirectory()) {
        // It's a file — preview it
        const content = previewFile(target);
        ctx.ui.notify(content, "info");
        return;
      }
      const lines = listDir(target, 0, 3);
      ctx.ui.notify([`Workspace: ${root}`, `Path: ${path.relative(root, target) || "."}`, "", ...lines].join("\n"), "info");
    },
  });

  // /preview <file> — preview a file
  pi.registerCommand("preview", {
    description: "Preview a file (Markdown, HTML, code, text)",
    handler: async (args, ctx) => {
      if (!args.trim()) { ctx.ui.notify("Usage: /preview <file-path>", "warning"); return; }
      const target = resolveSafe(args.trim());
      if (!target) { ctx.ui.notify("Path outside workspace", "warning"); return; }
      const content = previewFile(target);
      ctx.ui.notify(content, "info");
    },
  });

  // /workspace [path] — view or change workspace root
  pi.registerCommand("workspace", {
    description: "View or change workspace root (usage: /workspace [new-path])",
    handler: async (args, ctx) => {
      if (!args.trim()) {
        const root = getWorkspaceRoot()
        ctx.ui.notify(`Workspace: ${root}`, "info");
      } else {
        const newRoot = path.resolve(args.trim());
        if (!fs.existsSync(newRoot) || !fs.statSync(newRoot).isDirectory()) {
          ctx.ui.notify(`Not a valid directory: ${newRoot}`, "warning");
          return;
        }
        if (!isAllowedRoot(newRoot)) {
          ctx.ui.notify(`Not in allowed list. Allowed: ${ALLOWED_ROOTS.join(", ")}`, "warning");
          return;
        }
        workspaceRoot = newRoot;
        ctx.ui.notify(`Workspace set to: ${newRoot}`, "info");
      }
    },
  });
}
