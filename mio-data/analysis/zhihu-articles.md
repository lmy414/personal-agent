# 澪号 — 数据档案 · 知乎文章分析

> 收集日期：2026-05-27
> 来源：知乎专栏文章

## 文章 1：Cesium3DTile类

- URL：https://zhuanlan.zhihu.com/p/17328234218
- 作者：Mirror7
- 发布于：个人笔记专栏
- 赞同：1

### 内容

对 CesiumJS 源码 `Cesium3DTile` 类的逐行中文注释解析。涵盖：
- 3D Tiles 1.0 vs 1.1 版本差异处理（`content` vs `contents`）
- 瓦片变换矩阵计算（本地 transform × 父 computedTransform × tileset modelMatrix）
- 边界体积（boundingVolume, contentBoundingVolume, viewerRequestVolume）
- LOD 几何误差（geometricError）的回退逻辑
- Refine 策略（REPLACE / ADD）
- 多内容支持（3DTILES_multiple_contents 扩展）
- 废弃 API 警告处理（`content.url` vs `content.uri`）

### 风格特征

- 逐行注释，中文为主，变量名保留英文
- 注释风格："保存当前瓦片所属的 tileset（瓦片集）"—解释+翻译
- 不追求排版美观，代码块直接贴
- 标题简单直接：`Cesium3DTile类`
- 发布频率：极低（个人笔记，非内容创作者）

### 人格信号

- 读源码的习惯：逐行注释、理解每行含义
- 分享态度：写了就发了，不在意阅读量（1 赞）
- 技术深度：能解析 Cesium 这种大型框架的内部实现
- 领域：3D GIS / 地理信息 / 渲染
- 写作模式：做笔记给自己看，公开只是为了"万一有人需要"

## 文章 2：imgui显示简体中文

- URL：https://zhuanlan.zhihu.com/p/16789707605
- 状态：HTML 文件未正确保存，仅 _files 资源文件夹存在
- 需要：重新保存网页（Ctrl+S → 网页，仅HTML）

## 综合判断

知乎上 Mirror7 的形象是：
- 纯技术向，零社交互动（11 回答 2 文章，极低频率）
- 内容质量高但不在意传播
- "不做TA了"的签名暗示离开学术/教育岗位
- 与 GitHub 形象一致：实用主义、自己做自己用、不包装
