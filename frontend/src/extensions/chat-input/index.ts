// P0-02 修复：ChatRenderer 已内置完整输入区（附件 + 拖放 + 发送），
// ChatInput 是功能真子集，重复注册导致双重输入框。保留组件文件供未来重构。
// import { registry } from '@/registry'
// import { ChatInput } from './ChatInput'
//
// registry.register({
//   id: 'chat-input',
//   slot: 'center',
//   component: ChatInput,
// })
export {}
