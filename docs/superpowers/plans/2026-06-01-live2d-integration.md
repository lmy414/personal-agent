> **⚠️ 已废弃** — Live2D 集成已从主应用移除（2026-06-05）。详见 status doc。
> 此文档保留为历史参考。

# Live2D MCP → Bridge → 前端集成 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** MCP Server 通过 Bridge WebSocket 控制浏览器中的 Live2D 模型，LLM 可调用 `live2d_expression("smile")` 让角色实时反应。

**Architecture:** MCP Server 作为 Bridge 的 WebSocket 客户端连接，收到 JSON-RPC `tools/call` 后转发 `live2d.control` 消息到 Bridge，Bridge 转发到前端浏览器，前端 Cubism SDK 执行表情/动作并回传结果。

**Tech Stack:** TypeScript, WebSocket, PIXI.js, Cubism SDK for Web, SolidJS

---
