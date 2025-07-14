import { Connection, Keypair, PublicKey, EpochInfo, Commitment } from "@solana/web3.js";
import { merge } from "lodash";

import { Api, API_URL_CONFIG, ApiV3TokenRes, ApiV3Token, JupTokenType, AvailabilityCheckAPI3 } from "../api";
import { EMPTY_CONNECTION, EMPTY_OWNER } from "../common/error";
import { createLogger, Logger } from "../common/logger";
import { Owner } from "../common/owner";
import { Cluster } from "../solana";

import Account, { TokenAccountDataProp } from "./account/account";
import Farm from "./farm/farm";
import Liquidity from "./liquidity/liquidity";
import { Clmm } from "./clmm";
import Cpmm from "./cpmm/cpmm";
import TradeV2 from "./tradeV2/trade";
import Utils1216 from "./utils1216";
import MarketV2 from "./marketV2";
import Ido from "./ido";
import Launchpad from "./launchpad/launchpad";

import TokenModule from "./token/token";
import { SignAllTransactions } from "./type";

// Raydium 加载参数接口，继承了 TokenAccountDataProp 和 RaydiumApiBatchRequestParams（除了 api 字段）
export interface RaydiumLoadParams extends TokenAccountDataProp, Omit<RaydiumApiBatchRequestParams, "api"> {
  /* ================= solana ================= */
  // solana web3 连接实例
  connection: Connection;
  // solana 集群/网络/环境（如 mainnet, testnet, devnet）
  cluster?: Cluster;
  // 用户公钥或密钥对
  owner?: PublicKey | Keypair;
  /* ================= api ================= */
  // API 请求间隔时间（毫秒），-1 表示永不再次请求，0 表示总是使用最新数据，默认 5 分钟
  apiRequestInterval?: number;
  // API 请求超时时间（毫秒），默认 10 秒
  apiRequestTimeout?: number;
  // API 缓存时间
  apiCacheTime?: number;
  // 签名所有交易的回调函数
  signAllTransactions?: SignAllTransactions;
  // API URL 配置
  urlConfigs?: API_URL_CONFIG;
  // 是否记录请求日志
  logRequests?: boolean;
  // 日志计数
  logCount?: number;
  // Jupiter 代币类型
  jupTokenType?: JupTokenType;
  // 是否禁用功能检查
  disableFeatureCheck?: boolean;
  // 是否禁用代币加载
  disableLoadToken?: boolean;
  // 区块哈希承诺级别
  blockhashCommitment?: Commitment;
  // 是否循环多交易状态
  loopMultiTxStatus?: boolean;
}

// Raydium API 批量请求参数接口
export interface RaydiumApiBatchRequestParams {
  api: Api;
  // 默认链时间偏移量
  defaultChainTimeOffset?: number;
  // 默认链时间
  defaultChainTime?: number;
}

// Raydium 构造函数参数类型，所有参数都是必需的
export type RaydiumConstructorParams = Required<RaydiumLoadParams> & RaydiumApiBatchRequestParams;

// 数据基础接口，包含获取时间和数据本身
interface DataBase<T> {
  fetched: number; // 数据获取时间戳
  data: T; // 实际数据
  extInfo?: Record<string, any>; // 扩展信息
}

// API 数据接口，用于缓存各种 API 数据
interface ApiData {
  tokens?: DataBase<ApiV3Token[]>; // 代币数据
  tokenList?: DataBase<ApiV3TokenRes>; // v3 代币列表数据
  jupTokenList?: DataBase<ApiV3Token[]>; // Jupiter 代币列表数据
}

// Raydium 主类，整合了所有 DeFi 功能模块
export class Raydium {
  // 网络集群标识
  public cluster: Cluster;
  // 农场模块，处理流动性挖矿
  public farm: Farm;
  // 账户模块，管理用户账户信息
  public account: Account;
  // 流动性模块，处理流动性池操作
  public liquidity: Liquidity;
  // 集中流动性做市商模块
  public clmm: Clmm;
  // 常数乘积做市商模块
  public cpmm: Cpmm;
  // 交易 v2 模块
  public tradeV2: TradeV2;
  // 工具模块（1216 版本）
  public utils1216: Utils1216;
  // 市场 v2 模块
  public marketV2: MarketV2;
  // IDO（首次代币发行）模块
  public ido: Ido;
  // 代币模块
  public token: TokenModule;
  // 启动台模块
  public launchpad: Launchpad;
  // 原始余额映射，存储代币地址到余额的映射
  public rawBalances: Map<string, string> = new Map();
  // API 数据缓存
  public apiData: ApiData;
  // 功能可用性状态
  public availability: Partial<AvailabilityCheckAPI3>;
  // 区块哈希承诺级别
  public blockhashCommitment: Commitment;
  // 是否循环多交易状态
  public loopMultiTxStatus?: boolean;

  // 私有字段：Solana 连接实例
  private _connection: Connection;
  // 私有字段：用户所有者实例
  private _owner: Owner | undefined;
  // API 实例
  public api: Api;
  // 私有字段：API 缓存时间
  private _apiCacheTime: number;
  // 私有字段：签名所有交易的回调函数
  private _signAllTransactions?: SignAllTransactions;
  // 日志记录器
  private logger: Logger;
  // 私有字段：链时间缓存，包含获取时间和链时间/偏移量
  private _chainTime?: {
    fetched: number; // 获取时间戳
    value: {
      chainTime: number; // 链时间
      offset: number; // 时间偏移量
    };
  };
  // 私有字段：epoch 信息缓存
  private _epochInfo?: {
    fetched: number; // 获取时间戳
    value: EpochInfo; // epoch 信息
  };

  // 构造函数，初始化 Raydium 实例
  constructor(config: RaydiumConstructorParams) {
    // 从配置中解构必要的参数
    const {
      connection, // Solana 连接
      cluster, // 网络集群
      owner, // 用户所有者
      api, // API 实例
      defaultChainTime, // 默认链时间
      defaultChainTimeOffset, // 默认链时间偏移
      apiCacheTime, // API 缓存时间
      blockhashCommitment = "confirmed", // 区块哈希承诺级别，默认 confirmed
      loopMultiTxStatus, // 是否循环多交易状态
    } = config;

    // 设置 Solana 连接
    this._connection = connection;
    // 设置网络集群，默认为 mainnet
    this.cluster = cluster || "mainnet";
    // 设置用户所有者，如果存在则包装为 Owner 对象
    this._owner = owner ? new Owner(owner) : undefined;
    // 设置签名所有交易的回调函数
    this._signAllTransactions = config.signAllTransactions;
    // 设置区块哈希承诺级别
    this.blockhashCommitment = blockhashCommitment;
    // 设置是否循环多交易状态
    this.loopMultiTxStatus = loopMultiTxStatus;

    // 设置 API 实例
    this.api = api;
    // 设置 API 缓存时间，默认 5 分钟
    this._apiCacheTime = apiCacheTime || 5 * 60 * 1000;
    // 创建日志记录器
    this.logger = createLogger("Raydium");

    // 初始化所有功能模块，每个模块都接收当前实例作为 scope
    this.farm = new Farm({ scope: this, moduleName: "Raydium_Farm" });
    this.account = new Account({
      scope: this,
      moduleName: "Raydium_Account",
      tokenAccounts: config.tokenAccounts, // 代币账户列表
      tokenAccountRawInfos: config.tokenAccountRawInfos, // 代币账户原始信息
    });
    this.liquidity = new Liquidity({ scope: this, moduleName: "Raydium_LiquidityV2" });
    this.token = new TokenModule({ scope: this, moduleName: "Raydium_tokenV2" });
    this.tradeV2 = new TradeV2({ scope: this, moduleName: "Raydium_tradeV2" });
    this.clmm = new Clmm({ scope: this, moduleName: "Raydium_clmm" });
    this.cpmm = new Cpmm({ scope: this, moduleName: "Raydium_cpmm" });
    this.utils1216 = new Utils1216({ scope: this, moduleName: "Raydium_utils1216" });
    this.marketV2 = new MarketV2({ scope: this, moduleName: "Raydium_marketV2" });
    this.ido = new Ido({ scope: this, moduleName: "Raydium_ido" });
    this.launchpad = new Launchpad({ scope: this, moduleName: "Raydium_lauchpad" });

    // 初始化功能可用性状态为空对象
    this.availability = {};
    // 获取当前时间戳
    const now = new Date().getTime();
    // 初始化 API 数据缓存为空对象
    this.apiData = {};

    // 如果提供了默认链时间偏移，则初始化链时间缓存
    if (defaultChainTimeOffset)
      this._chainTime = {
        fetched: now, // 设置获取时间为当前时间
        value: {
          // 计算链时间：如果提供了默认链时间则使用，否则用当前时间减去偏移量
          chainTime: defaultChainTime || Date.now() - defaultChainTimeOffset,
          offset: defaultChainTimeOffset, // 时间偏移量
        },
      };
  }

  // 静态方法：异步加载并创建 Raydium 实例
  static async load(config: RaydiumLoadParams): Promise<Raydium> {
    // 使用 lodash merge 合并默认配置和用户配置
    const custom: Required<RaydiumLoadParams> = merge(
      // 默认配置
      {
        cluster: "mainnet", // 默认主网
        owner: null, // 默认无所有者
        apiRequestInterval: 5 * 60 * 1000, // 默认 API 请求间隔 5 分钟
        apiRequestTimeout: 10 * 1000, // 默认 API 请求超时 10 秒
      },
      config, // 用户配置
    );

    // 从合并后的配置中提取必要参数
    const { cluster, apiRequestTimeout, logCount, logRequests, urlConfigs } = custom;

    // 创建 API 实例
    const api = new Api({ cluster, timeout: apiRequestTimeout, urlConfigs, logCount, logRequests });

    // 创建 Raydium 实例
    const raydium = new Raydium({
      ...custom, // 展开所有配置
      api, // 添加 API 实例
    });

    // 获取功能可用性状态，如果禁用功能检查则跳过
    await raydium.fetchAvailabilityStatus(config.disableFeatureCheck ?? true);

    // 如果未禁用代币加载，则加载代币信息
    if (!config.disableLoadToken)
      await raydium.token.load({
        type: config.jupTokenType, // 使用指定的 Jupiter 代币类型
      });

    // 返回完全初始化的 Raydium 实例
    return raydium;
  }

  // 获取用户所有者的 getter 方法
  get owner(): Owner | undefined {
    return this._owner;
  }

  // 获取用户所有者公钥的 getter 方法
  get ownerPubKey(): PublicKey {
    // 如果没有所有者，抛出错误
    if (!this._owner) throw new Error(EMPTY_OWNER);
    return this._owner.publicKey;
  }

  // 设置用户所有者的方法
  public setOwner(owner?: PublicKey | Keypair): Raydium {
    // 如果提供了所有者，则包装为 Owner 对象，否则设为 undefined
    this._owner = owner ? new Owner(owner) : undefined;
    // 重置代币账户信息
    this.account.resetTokenAccounts();
    // 返回当前实例以支持链式调用
    return this;
  }

  // 获取 Solana 连接的 getter 方法
  get connection(): Connection {
    // 如果没有连接，抛出错误
    if (!this._connection) throw new Error(EMPTY_CONNECTION);
    return this._connection;
  }

  // 设置 Solana 连接的方法
  public setConnection(connection: Connection): Raydium {
    this._connection = connection;
    // 返回当前实例以支持链式调用
    return this;
  }

  // 获取签名所有交易回调函数的 getter 方法
  get signAllTransactions(): SignAllTransactions | undefined {
    return this._signAllTransactions;
  }

  // 设置签名所有交易回调函数的方法
  public setSignAllTransactions(signAllTransactions?: SignAllTransactions): Raydium {
    this._signAllTransactions = signAllTransactions;
    // 返回当前实例以支持链式调用
    return this;
  }

  // 检查是否有用户所有者的方法
  public checkOwner(): void {
    if (!this.owner) {
      // 如果没有所有者，记录错误并抛出异常
      console.error(EMPTY_OWNER);
      throw new Error(EMPTY_OWNER);
    }
  }

  // 私有方法：检查缓存是否已失效
  private isCacheInvalidate(time: number): boolean {
    // 如果当前时间减去缓存时间大于缓存有效期，则缓存失效
    return new Date().getTime() - time > this._apiCacheTime;
  }

  // 异步方法：获取链时间信息
  public async fetchChainTime(): Promise<void> {
    try {
      // 调用 API 获取链时间偏移
      const data = await this.api.getChainTimeOffset();
      // 缓存链时间信息
      this._chainTime = {
        fetched: Date.now(), // 记录获取时间
        value: {
          // 计算链时间：当前时间加上偏移量（转换为毫秒）
          chainTime: Date.now() + data.offset * 1000,
          // 偏移量（转换为毫秒）
          offset: data.offset * 1000,
        },
      };
    } catch {
      // 如果获取失败，清空链时间缓存
      this._chainTime = undefined;
    }
  }

  // 异步方法：获取 Raydium v3 代币列表
  public async fetchV3TokenList(forceUpdate?: boolean): Promise<ApiV3TokenRes> {
    // 如果有缓存且未失效且不强制更新，则返回缓存数据
    if (this.apiData.tokenList && !this.isCacheInvalidate(this.apiData.tokenList.fetched) && !forceUpdate)
      return this.apiData.tokenList.data;

    try {
      // 调用 API 获取代币列表
      const raydiumList = await this.api.getTokenList();
      // 创建数据对象
      const dataObject = {
        fetched: Date.now(), // 记录获取时间
        data: raydiumList, // 存储数据
      };
      // 更新缓存
      this.apiData.tokenList = dataObject;

      // 返回数据
      return dataObject.data;
    } catch (e) {
      // 如果获取失败，记录错误并返回空数据
      console.error(e);
      return {
        mintList: [], // 空的铸币列表
        blacklist: [], // 空的黑名单
        whiteList: [], // 空的白名单
      };
    }
  }

  // 异步方法：获取 Jupiter 代币列表
  public async fetchJupTokenList(forceUpdate?: boolean): Promise<ApiV3Token[]> {
    // 获取之前的缓存
    const prevFetched = this.apiData.jupTokenList;
    // 如果有缓存且未失效且不强制更新，则返回缓存数据
    if (prevFetched && !this.isCacheInvalidate(prevFetched.fetched) && !forceUpdate) return prevFetched.data;

    try {
      // 调用 API 获取 Jupiter 代币列表
      const jupList = await this.api.getJupTokenList();

      // 更新缓存，并处理字段名转换
      this.apiData.jupTokenList = {
        fetched: Date.now(), // 记录获取时间
        data: jupList.map((t) => ({
          ...t, // 展开所有字段
          // 转换字段名：mint_authority -> mintAuthority
          mintAuthority: t.mint_authority || undefined,
          // 转换字段名：freeze_authority -> freezeAuthority
          freezeAuthority: t.freeze_authority || undefined,
        })),
      };

      // 返回处理后的数据
      return this.apiData.jupTokenList.data;
    } catch (e) {
      // 如果获取失败，记录错误并返回空数组
      console.error(e);
      return [];
    }
  }

  // 获取链时间数据的 getter 方法
  get chainTimeData(): { offset: number; chainTime: number } | undefined {
    return this._chainTime?.value;
  }

  // 异步方法：获取链时间偏移量
  public async chainTimeOffset(): Promise<number> {
    // 如果缓存存在且未超过 5 分钟，则直接返回缓存的偏移量
    if (this._chainTime && Date.now() - this._chainTime.fetched <= 1000 * 60 * 5) return this._chainTime.value.offset;

    // 否则重新获取链时间
    await this.fetchChainTime();
    // 返回偏移量，如果获取失败则返回 0
    return this._chainTime?.value.offset || 0;
  }

  // 异步方法：获取当前区块链时间
  public async currentBlockChainTime(): Promise<number> {
    // 如果缓存存在且未超过 5 分钟，则直接返回缓存的链时间
    if (this._chainTime && Date.now() - this._chainTime.fetched <= 1000 * 60 * 5)
      return this._chainTime.value.chainTime;

    // 否则重新获取链时间
    await this.fetchChainTime();
    // 返回链时间，如果获取失败则返回当前时间
    return this._chainTime?.value.chainTime || Date.now();
  }

  // 异步方法：获取 epoch 信息
  public async fetchEpochInfo(): Promise<EpochInfo> {
    // 如果缓存存在且未超过 30 秒，则直接返回缓存的 epoch 信息
    if (this._epochInfo && Date.now() - this._epochInfo.fetched <= 1000 * 30) return this._epochInfo.value;

    // 否则重新获取 epoch 信息
    this._epochInfo = {
      fetched: Date.now(), // 记录获取时间
      value: await this.connection.getEpochInfo(), // 从连接获取 epoch 信息
    };

    // 返回 epoch 信息
    return this._epochInfo.value;
  }

  // 异步方法：获取功能可用性状态
  public async fetchAvailabilityStatus(skipCheck?: boolean): Promise<Partial<AvailabilityCheckAPI3>> {
    // 如果跳过检查，则返回空对象
    if (skipCheck) return {};

    try {
      // 调用 API 获取可用性状态
      const data = await this.api.fetchAvailabilityStatus();
      // 检查是否所有功能都被禁用
      const isAllDisabled = data.all === false;

      // 更新可用性状态，如果全部禁用则所有功能都设为 false
      this.availability = {
        all: data.all, // 总体可用性
        swap: isAllDisabled ? false : data.swap, // 交换功能
        createConcentratedPosition: isAllDisabled ? false : data.createConcentratedPosition, // 创建集中流动性位置
        addConcentratedPosition: isAllDisabled ? false : data.addConcentratedPosition, // 添加集中流动性位置
        addStandardPosition: isAllDisabled ? false : data.addStandardPosition, // 添加标准流动性位置
        removeConcentratedPosition: isAllDisabled ? false : data.removeConcentratedPosition, // 移除集中流动性位置
        removeStandardPosition: isAllDisabled ? false : data.removeStandardPosition, // 移除标准流动性位置
        addFarm: isAllDisabled ? false : data.addFarm, // 添加农场
        removeFarm: isAllDisabled ? false : data.removeFarm, // 移除农场
      };

      // 返回原始数据
      return data;
    } catch {
      // 如果获取失败，返回空对象
      return {};
    }
  }
}
