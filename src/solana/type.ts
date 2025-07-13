/**
 * Solana 类型定义文件
 *
 * 这个文件定义了与 Solana 区块链交互时使用的核心类型。
 * 主要用于指定 Solana 网络集群的类型。
 */

/**
 * Solana 网络集群类型
 *
 * 定义了 Solana 区块链支持的网络环境：
 * - "mainnet": 主网环境，用于生产环境
 * - "devnet": 开发网环境，用于测试和开发
 *
 * 这个类型通常用于：
 * - 配置 SDK 连接的网络
 * - 区分生产环境和测试环境
 * - 设置 RPC 端点
 */
export type Cluster = "mainnet" | "devnet";
