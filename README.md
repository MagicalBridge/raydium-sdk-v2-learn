# Raydium SDK

[npm-image]: https://img.shields.io/npm/v/@raydium-io/raydium-sdk-v2.svg?style=flat
[npm-url]: https://www.npmjs.com/package/@raydium-io/raydium-sdk-v2

[![npm][npm-image]][npm-url]

An SDK for building applications on top of Raydium.

**中文**: 用于在 Raydium 基础上构建应用程序的 SDK。

## Usage Guide

**使用指南**

### Installation

**安装**

```
$ yarn add @raydium-io/raydium-sdk-v2
```

**中文说明**: 使用 yarn 包管理器安装 Raydium SDK V2 包。

## SDK method Demo

**SDK 方法示例**

[SDK V2 Demo Repo](https://github.com/raydium-io/raydium-sdk-V2-demo)

**中文**: 点击上面的链接查看 SDK V2 的演示代码仓库，里面包含了各种使用示例。

## SDK local test

**SDK 本地测试**

```
$ yarn dev {directory}

e.g. yarn dev test/init.ts
```

**中文说明**: 
- 使用 `yarn dev {目录}` 命令进行本地开发和测试
- 例如：`yarn dev test/init.ts` 会运行 test/init.ts 文件进行测试

## Features

**功能特性**

### Initialization

**初始化**

```javascript
import { Raydium } from "@raydium-io/raydium-sdk";
const raydium = await Raydium.load({
  connection,
  owner, // key pair or publicKey, if you run a node process, provide keyPair
  signAllTransactions, // optional - provide sign functions provided by @solana/wallet-adapter-react
  tokenAccounts, // optional, if dapp handle it by self can provide to sdk
  tokenAccountRowInfos, // optional, if dapp handle it by self can provide to sdk
  disableLoadToken: false, // default is false, if you don't need token info, set to true
});
```

**中文说明**:
```javascript
import { Raydium } from "@raydium-io/raydium-sdk";
const raydium = await Raydium.load({
  connection,                    // Solana 网络连接
  owner,                        // 密钥对或公钥，如果运行节点进程，请提供密钥对
  signAllTransactions,          // 可选 - 提供由 @solana/wallet-adapter-react 提供的签名函数
  tokenAccounts,               // 可选，如果 dapp 自己处理，可以提供给 SDK
  tokenAccountRowInfos,        // 可选，如果 dapp 自己处理，可以提供给 SDK
  disableLoadToken: false,     // 默认为 false，如果不需要代币信息，设置为 true
});
```

#### how to transform token account data

**如何转换代币账户数据**

```javascript
import { parseTokenAccountResp } from "@raydium-io/raydium-sdk";

const solAccountResp = await connection.getAccountInfo(owner.publicKey);
const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID });
const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID });
const tokenAccountData = parseTokenAccountResp({
  owner: owner.publicKey,
  solAccountResp,
  tokenAccountResp: {
    context: tokenAccountResp.context,
    value: [...tokenAccountResp.value, ...token2022Req.value],
  },
});
```

**中文说明**:
```javascript
// 从 SDK 导入解析函数
import { parseTokenAccountResp } from "@raydium-io/raydium-sdk";

// 获取 SOL 账户信息
const solAccountResp = await connection.getAccountInfo(owner.publicKey);
// 获取标准代币账户
const tokenAccountResp = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_PROGRAM_ID });
// 获取 Token-2022 程序的代币账户
const token2022Req = await connection.getTokenAccountsByOwner(owner.publicKey, { programId: TOKEN_2022_PROGRAM_ID });
// 解析并合并所有代币账户数据
const tokenAccountData = parseTokenAccountResp({
  owner: owner.publicKey,
  solAccountResp,
  tokenAccountResp: {
    context: tokenAccountResp.context,
    value: [...tokenAccountResp.value, ...token2022Req.value],  // 合并两种类型的代币账户
  },
});
```

#### data after initialization

**初始化后的数据**

```
# token
raydium.token.tokenList
raydium.token.tokenMap
raydium.token.mintGroup


# token account
raydium.account.tokenAccounts
raydium.account.tokenAccountRawInfos
```

**中文说明**:
```
# 代币相关数据
raydium.token.tokenList          // 代币列表
raydium.token.tokenMap           // 代币映射表
raydium.token.mintGroup          // 铸币分组

# 代币账户相关数据
raydium.account.tokenAccounts         // 代币账户信息
raydium.account.tokenAccountRawInfos  // 代币账户原始信息
```

#### Api methods (https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/api/api.ts)

**API 方法** (详细信息请查看: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/api/api.ts)

- fetch raydium default mint list (mainnet only)

**获取 Raydium 默认铸币列表（仅主网）**

```javascript
const data = await raydium.api.getTokenList();
```

**中文说明**: 获取 Raydium 平台支持的默认代币列表，仅在主网环境下可用。

- fetch mints recognizable by raydium

**获取 Raydium 可识别的铸币信息**

```javascript
const data = await raydium.api.getTokenInfo([
  "So11111111111111111111111111111111111111112",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
]);
```

**中文说明**: 通过传入铸币地址数组，获取这些代币的详细信息。示例中获取的是 SOL 和另一个代币的信息。

- fetch pool list (mainnet only)
  available fetch params defined here: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/api/type.ts#L249

**获取池子列表（仅主网）**
可用的获取参数定义在这里: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/api/type.ts#L249

```javascript
const data = await raydium.api.getPoolList({});
```

**中文说明**: 获取 Raydium 上的流动性池列表。可以传入筛选参数来获取特定条件的池子，具体参数请查看链接中的类型定义。

- fetch poolInfo by id (mainnet only)

**通过 ID 获取池子信息（仅主网）**

```javascript
// ids: join pool ids by comma(,)
const data = await raydium.api.fetchPoolById({
  ids: "AVs9TA4nWDzfPJE9gGVNJMVhcQy3V9PGazuz33BfG2RA,8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj",
});
```

**中文说明**: 通过池子 ID 获取特定池子的详细信息。可以同时查询多个池子，多个 ID 之间用逗号分隔。

- fetch pool list by mints (mainnet only)

**通过铸币地址获取池子列表（仅主网）**

```javascript
const data = await raydium.api.fetchPoolByMints({
  mint1: "So11111111111111111111111111111111111111112",
  mint2: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R", // optional,
  // extra params: https://github.com/raydium-io/raydium-sdk-V2/blob/master/src/api/type.ts#L249
});
```

**中文说明**: 
- 通过代币的铸币地址来查找包含这些代币的流动性池
- `mint1`: 第一个代币的铸币地址（必需）
- `mint2`: 第二个代币的铸币地址（可选）
- 额外参数可参考类型定义链接

- fetch farmInfo by id (mainnet only)

**通过 ID 获取农场信息（仅主网）**

```javascript
// ids: join farm ids by comma(,)
const data = await raydium.api.fetchFarmInfoById({
  ids: "4EwbZo8BZXP5313z5A2H11MRBP15M5n6YxfmkjXESKAW,HUDr9BDaAGqi37xbQHzxCyXvfMCKPTPNF8g9c9bPu1Fu",
});
```

**中文说明**: 通过农场 ID 获取流动性挖矿农场的详细信息。可以同时查询多个农场，多个 ID 之间用逗号分隔。
