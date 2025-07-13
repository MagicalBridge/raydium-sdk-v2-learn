/**
 * Raydium SDK v2 主入口文件
 *
 * 这个文件是 Raydium SDK 的主要导出入口，将所有核心模块重新导出，
 * 使得用户可以通过单一入口访问所有 SDK 功能。
 */

// 导出 API 相关功能模块
// 包含与 Raydium 后端 API 交互的工具函数、类型定义和 URL 配置
export * from "./api";

// 导出通用工具模块
// 包含账户信息、大数字处理、常量定义、日期处理、错误处理、
// 费用计算、分数工具、JSON 文件处理、Lodash 工具、日志记录、
// 所有者管理、PDA（Program Derived Address）生成、程序 ID、
// 公钥处理、转账工具和交易工具等通用功能
export * from "./common";

// 导出 Raydium 核心功能模块
// 包含 Raydium 协议的所有核心功能：
// - 账户管理（account）
// - 集中流动性做市商（CLMM）
// - 恒定乘积做市商（CPMM）
// - 农场功能（farm）
// - IDO 功能（ido）
// - 启动板功能（launchpad）
// - 流动性管理（liquidity）
// - 市场 V2（marketV2）
// - Serum 集成（serum）
// - 代币管理（token）
// - 交易 V2（tradeV2）
export * from "./raydium";

// 导出 Solana 区块链相关功能模块
// 包含与 Solana 区块链交互的类型定义和基础功能
export * from "./solana";

// 导出核心数据模块
// 包含金额、货币、格式化、分数、百分比、价格、代币等基础数据类型和工具
export * from "./module";

// 导出 Marshmallow 序列化模块
// 包含用于数据序列化和反序列化的 buffer-layout 工具
export * from "./marshmallow";
