# Personal Agent — 扩展开发手册：核心原则

> 版本：v1.0  
> 目标：新增一个扩展时，只需理解本手册 + ExtensionAPI 接口，无需阅读其他扩展的源码。

## 1. 独立解耦

每个扩展是一个**自包含的 TypeScript 文件**，遵循以下约束：

| 规则 | 说明 |
|------|------|
| 不直接 import 其他 `pa-*` 扩展 | 禁止 `import { foo } from "../pa-xxx/index.ts"` |
| 不依赖其他扩展的加载顺序 | 不能假设 pa-sqlite 一定在 pa-usage 之前加载 |
| 不共享可变全局状态 | 禁止在 `shared/` 之外创建被多个扩展修改的变量 |
| 自给自足 | 扩展自己负责打开/关闭自己的资源（DB、文件、定时器） |

## 2. 最小化影响

- 修改一个扩展的**内部逻辑**，不应影响其他扩展的运行
- 修改一个扩展的**数据库表结构**，必须通过**新表**或**新字段**实现，禁止删除/重命名其他扩展已使用的表/字段
- 扩展之间通过**宿主事件总线**间接通信，不直接调用

## 3. 新增即插即用

新增扩展只需要：
1. 创建 `extensions/pa-<name>/index.ts`
2. 在 `.pi/settings.json` 的 `extensions` 数组中追加一行路径
3. 运行 `pi`（宿主会自动编译并加载）

不需要修改：wgnr-pi server.js、其他扩展、package.json、shared/ 模块。

## 4. 扩展加载生命周期

```
settings.json 列出扩展路径
      ↓
Pi 宿主按顺序读取每个路径
      ↓
jiti 运行时编译 TypeScript
      ↓
调用 export default function(api)  —— 扩展在此注册事件/命令/工具
      ↓
扩展运行期：通过事件回调响应宿主行为
      ↓
宿主退出 / 扩展热重载 → 扩展生命周期结束（无显式 unload hook）
```

**关键认知**：扩展是**工厂函数**，被调用一次即完成初始化。没有 `deactivate` 钩子，因此必须在 `session_shutdown` 事件中清理资源。

---

**下一章**：
- 最小模板 → `01-template.md`
- API 速查 → `02-api.md`
