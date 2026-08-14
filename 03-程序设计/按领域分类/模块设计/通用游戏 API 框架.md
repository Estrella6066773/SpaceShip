# 通用游戏 API 框架与 SequenceMap 接入规划

> 作者：AI 规划 | 创建日期：2026-08-14 | 状态：规划落地中

本文档定义 SpaceShip 的通用游戏能力 API 框架：**核心能力层**（不依赖任何具体工具）+ **SequenceMap 适配层**（扁平签名接入流程图）。API 框架服务所有消费者（SequenceMap / 游戏系统 / UI / 测试 / 编辑器工具），并规划各系统逐步演进为「行为可经 API 完成」。

---

## 1. 背景与目标

游戏核心玩法已具备稳定的领域服务（商店 / 仓库 / 车间 / 任务 / 存档），当前缺少「可编程化」接入：
策划与 QA 无法用流程图编排玩法流程、查询状态或等待事件，其他系统也无法复用统一的能力入口。

目标：**制作最通用的游戏能力 API 框架**——

1. **通用性**：核心能力层是纯 C# 静态门面，签名类型化（真枚举、领域对象），不绑定 SequenceMap，任何消费者直接调用；
2. **可编程化**：通过 SequenceMap 适配层把能力暴露为流程图可发现的 API（扁平签名 + 中文元数据）；
3. **覆盖度**：现有系统逐步演进，让大多数玩法行为可经 API 完成（Command / Query 入口）；
4. **双向**：图 → 游戏（静态 API）与 游戏 → 图（`GraphControlService` 反向桥）都可达。

### 约束

- SequenceMap 是第三方框架，**只新增 API，不修改框架本体**。
- 游戏系统间通信仍遵守事件-订阅规范；API 层是「外部指令 / 查询」入口，属 Command / Query 例外。
- API 必须位于运行时程序集（Editor 程序集不可用）。
- 核心能力层**不引用** SequenceMap 命名空间（语义解耦）；SequenceMap 专属元数据只存在于适配层。

---

## 2. SequenceMap 接入方式

SequenceMap 通过以下机制消费游戏能力；其中**静态方法 API 由适配层提供**，核心能力层不直接暴露给 SequenceMap：

| 方式 | 机制 | 游戏侧用法 |
|---|---|---|
| 静态方法 API | 适配层 `public static` + `[SequenceMapApi]`，Registry 扫描 | 命令 / 查询 |
| 事件等待 | `SequenceMapBindEventService` / 图内 `OnXXX`、`OnCustomEvent` 节点 | 游戏事件源转发为绑定事件 |
| 变量 | Runner 局部变量 / `SequenceMapGlobalVariableLibrary` | 跨流程图共享状态 |

### API 签名约束（来自 code-generation.md，适配层适用）

- 参数 / 返回值限：`int`、`float`、`bool`、`string`、`Vector3`、`GameObject`、`Transform`、`Component` 及其数组
- 命令方法返回 `bool` 直接驱动 success / failure 分支
- 枚举映射为 `string` / `int`；`Vector2` 映射为 `Vector3`
- 线程安全一律标 `UnityObject`（游戏状态都在主线程）
- 返回 `IEnumerator` 的方法自动成为异步动作节点

> 核心能力层**不受此约束**：它使用类型化签名（真枚举如 `CargoCategory` / `ModuleKind` / `MissionState`），扁平化翻译发生在适配层（`ApiEnum` 负责字符串 → 枚举解析）。

---

## 3. 整体架构

```text
Scripts/Api/
  Meta/GameApiAttribute.cs          —— 通用能力元数据特性（名称/分类/描述），不依赖 SequenceMap
  Locator/GameServiceLocator.cs     —— 场景装配期注册系统实例，静态 API 统一取用
  Locator/ApiServices.cs            —— 服务解析辅助（Locator 优先，场景查找兜底）
  Bridge/GameEventBridge.cs         —— 游戏事件源 → SequenceMap 绑定事件转发
  Bridge/GraphControlService.cs     —— 反向桥：游戏代码 → 流程图的主动控制
  Modules/                          —— 核心能力层：类型化签名，无 SequenceMap 依赖
    ApiEnum.cs       枚举字符串解析辅助（供适配层使用）
    GameApi.cs       存档 / 经济 / 全局进度
    WarehouseApi.cs  仓库与库存
    ShopApi.cs       商店
    ShipApi.cs       飞船局内查询 / 模块操作
    WorkshopApi.cs   车间
    FlowApi.cs       流程控制
    MissionApi.cs    任务查询 / 接取 / 进度 / 结局
  Adapters/SequenceMap/             —— SequenceMap 适配层：扁平签名 + [SequenceMapApi] 转发
    SequenceMapGameApi.cs       存档 / 经济
    SequenceMapWarehouseApi.cs  仓库与库存
    SequenceMapShopApi.cs       商店
    SequenceMapShipApi.cs       飞船
    SequenceMapWorkshopApi.cs   车间
    SequenceMapFlowApi.cs       流程控制
    SequenceMapMissionApi.cs    任务
  Bootstrap/GameApiBootstrap.cs     —— 场景装配组件：注册服务 + 接线事件桥 + 注册反向桥
```

### 3.0 两层分离：核心能力层 + 适配层

这是本框架的骨架。**核心能力层（`Modules`）与 SequenceMap 解耦**，SequenceMap 只是其中一个消费者：

```text
领域服务层       MissionService / ShopService / ShipWorkshopEditingService / GameSaveService ...
   │  能力收敛（类型化签名 + 服务解析）
核心能力层       Modules（GameApi / ShopApi / MissionApi ...）+ Locator + Meta
   │  多消费者共用
消费者           SequenceMap（经 Adapters 适配层） ← 游戏系统 ← UI ← 测试 ← 编辑器工具
```

- **核心能力层**：`public static` 方法 + `[GameApi]` 通用特性（名称/分类/描述），签名类型化（枚举、`out` 原因），通过 `ApiServices` 统一解析服务，任何 C# 代码可直接调用，不感知 SequenceMap。
- **适配层（`Adapters/SequenceMap`）**：每个核心模块一个适配类，方法带完整 `[SequenceMapApi]` 中文元数据，参数扁平化（字符串枚举），内部经 `ApiEnum` 解析后转发到核心层。SequenceMap 面板看到的是适配层方法。
- **元数据分工**：核心层 `[GameApi]` 面向所有消费者；适配层 `[SequenceMapApi]` 面向 SequenceMap 面板（含 parameterDescription / returnDescription / example / threadSafety）。
- **程序集策略**：保持 `Spaceship.Game` 单程序集（避免游戏系统调 API 与 API 调领域服务形成程序集循环引用），以命名空间与 using 做语义隔离。

### 3.1 GameServiceLocator

静态 API 无法直接持有场景实例，需要服务定位层：

```csharp
public sealed class GameServiceLocator : MonoBehaviour
{
    public static GameServiceLocator Instance { get; private set; }
    public void Register<T>(T service) where T : class;
    public bool TryResolve<T>(out T service) where T : class;
}
```

- 场景中各装配器（`MissionSystem` / `ShopSystem` / `ShipWorkshopEditingService`）在 `EnsureInitialized()` 装配期注册自身
- 静态 API 一律 `TryResolve`，取不到返回 `false` / 默认值
- 单例生命周期随场景，不跨场景常驻；每个场景装配一次

### 3.2 GameEventBridge

把游戏事件源广播的事实转发为 SequenceMap 绑定事件，使流程图可用 `OnXXX` 节点等待：

```csharp
public static class GameEventBridge
{
    // 场景装配期调用：将 ShipFlowEventSource 的事件转发为 SequenceMap 绑定事件
    public static void WireShipFlow(ShipFlowEventSource source);
    public static void WireCargo(CargoEventSource source);
    public static void WireMission(MissionEventSource source);
    public static void WireWorkshop(WorkshopEventSource source);
}
```

事件名使用 `OnXxx` 前缀（与 SequenceMap 事件节点约定一致），例如 `OnShipDestroyed`、`OnCargoChanged`、`OnMissionEnded`。

### 3.3 GraphControlService —— 反向桥

静态 API 覆盖「图 → 游戏」；反向「游戏 → 图」由 `GraphControlService` 提供，它是游戏代码主动驱动流程图的总入口，注册进 `GameServiceLocator` 供游戏系统解析：

```csharp
public sealed class GraphControlService : MonoBehaviour
{
    // Runner 管理
    public IReadOnlyList<SequenceMapGraphRunner> Runners { get; }
    public void RegisterRunner(SequenceMapGraphRunner runner);
    public SequenceMapGraphRunner FindRunner(string graphDisplayName);

    // 激活 / 停止
    public bool Activate(SequenceMapGraphRunner runner);
    public bool Activate(string graphDisplayName);
    public bool Stop(SequenceMapGraphRunner runner);      // 禁用 Runner 组件，触发 OnDisable 停协程
    public bool Restart(SequenceMapGraphRunner runner);

    // 自定义事件（OnCustomEvent）
    public void TriggerEvent(SequenceMapGraphRunner runner, string eventName, params int[] values);
    public void TriggerEvent(string graphDisplayName, string eventName, params int[] values);
    public void TriggerAllEvent(string eventName, params int[] values);

    // 绑定事件（OnXXX）
    public void TriggerBindEvent(string eventName);
    public void TriggerBindEvent(SequenceMapGraphRunner runner, string eventName);
    public void BindToEvent(string eventName, Action callback);   // C# 监听
    public void UnbindEvent(string eventName, Action callback);

    // Runner 局部变量
    public bool SetRunnerInt/Float/Bool/String/Vector(...);
    public int  GetRunnerInt(...);   public float GetRunnerFloat(...);   // 等

    // 全局变量（跨图共享）
    public void SetGlobalInt/Float/Bool/String/Vector(...);
    public int  GetGlobalInt(...);   public float GetGlobalFloat(...);   // 等
}
```

设计要点：

- **只做驱动，不做业务判断**：服务封装「激活 / 停止 / 投递事件 / 读写变量」，不含玩法逻辑；游戏系统的正常事件仍走 `GameEventBridge` 广播，反向桥只服务「必须命令式、要顺序或返回值」的场景。
- **Runner 装配**：场景装配期显式注入 Runner，留空时 Awake 自动查找场景全部 Runner；`FindRunner` 按图显示名定位。
- **停止语义**：复用框架 `OnDisable` 行为（禁用组件 → 停止协程），不修改框架本体。
- **事件定向**：`TriggerEvent(runner, ...)` 只投递指定 Runner；`TriggerAllEvent` 广播全场景。绑定事件与自定义事件走不同通道（`__bind__:` 前缀隔离），不要混用。
- **变量读写**：Runner 局部变量依赖已激活的图（未激活时 setter 返回 `false`）；全局变量独立于图，由 `SequenceMapGlobalVariableService` 承载。

---

## 4. 模块划分

| 模块 | 静态类 | 主要能力 | 优先级 |
|---|---|---|---|
| 存档与经济 | `GameApi` | 金币、欠账、天数、全局进度、首次游戏 | P0 |
| 商店 | `ShopApi` | 货架查询、买/卖/回购、刷新 | P0 |
| 仓库与库存 | `WarehouseApi` | 模块/货物/船体库存查询与增删 | P0 |
| 车间 | `WorkshopApi` | 编辑区、出航校验、最低供给 | P0 |
| 飞船 | `ShipApi` | 模块/质量/载荷/核心/货舱查询、模块操作 | P0 |
| 流程控制 | `FlowApi` | 状态机、进出模式、暂停、结算、失败 | P0 |
| 任务 | `MissionApi` | 任务查询、接取、进度、结局 | P0 |
| 事件桥 | `GameEventBridge` | 游戏事件 → SequenceMap 事件 | P0 |
| 战斗 | `CombatApi` | 开火、护盾、钩爪、雷达、弹药 | P1 |
| 移动/导航 | `NavigationApi` | 移动、转向、停止 | P1 |
| 资源消耗 | `ResourcesApi` | 燃料/食物/弹药消耗与阈值 | P1 |
| 世界/探索 | `WorldApi` | 目的地、残骸、小行星、结算信息 | P1 |

---

## 5. 第一批 API 清单（P0）

> 本节签名为 **SequenceMap 面板可见的适配层扁平签名**（`Adapters/SequenceMap`）；核心能力层（`Modules`）使用类型化签名（如 `ModuleKind`、`CargoCategory`、`MissionState` 枚举参数与 `out` 原因），C# 消费者直接调用核心层。

### 5.1 GameApi —— 存档 / 经济

| API | 签名 | 说明 |
|---|---|---|
| 获取金币 | `int GetCoins()` | 存档当前金币 |
| 获取欠账 | `int GetDebt()` | 存档欠账 |
| 增加金币 | `bool AddCoins(int amount)` | 金币增加 |
| 扣除金币 | `bool DeductCoins(int amount)` | 金币不足返回 false |
| 获取累计天数 | `int GetTotalDays()` | 存档累计天数 |
| 读取全局进度 | `int GetGlobalProgress(string progressId)` | 全局计数器 |
| 累加全局进度 | `bool AccumulateGlobalProgress(string progressId, int increment)` | 全局计数器累加 |
| 是否首次游戏 | `bool IsFirstGame()` | 首次标记 |
| 立即保存 | `bool SaveNow()` | 强制写盘（非测试模式） |

### 5.2 WarehouseApi —— 仓库 / 库存

| API | 签名 | 说明 |
|---|---|---|
| 查询模块库存 | `int CountModules(string kind, string facing)` | 存档模块库存（类别×朝向） |
| 增加模块库存 | `bool AddModules(string kind, string facing, int count)` | 追加库存 |
| 扣除模块库存 | `bool RemoveModules(string kind, string facing, int count)` | 扣除库存 |
| 查询货物库存 | `int CountCargo(string category)` | 存档货物库存 |
| 增加货物库存 | `bool AddCargo(string category, int amount)` | 追加货物 |
| 扣除货物库存 | `bool RemoveCargo(string category, int amount)` | 扣除货物 |
| 查询仓库模块 | `int CountWarehouseModules(string kind, string facing)` | 绑定仓库模块堆叠格 |
| 仓库放入模块 | `bool WarehouseAddModules(string kind, string facing, int count)` | 优先合并后占空 |
| 仓库取出模块 | `bool WarehouseTakeModules(string kind, string facing, int count)` | 优先扣合并格 |
| 仓库放入货物 | `bool WarehouseAddItems(string category, int amount)` | 按类别放入 |
| 仓库取出货物 | `bool WarehouseTakeItems(string category, int amount)` | 按类别取出 |
| 仓库是否可扩容 | `bool WarehouseCanExpand(int moduleSlots, int itemSlots)` | 预检 |
| 仓库扩容 | `bool WarehouseExpand(int moduleSlots, int itemSlots)` | 执行扩容 |

### 5.3 ShopApi —— 商店

| API | 签名 | 说明 |
|---|---|---|
| 获取商店货架 | `int GetShelfRemaining(string goodsKey)` | 按商品键查询剩余库存 |
| 查询购买价 | `int GetBuyPrice(string goodsKey)` | 商品实际购买价 |
| 查询出售价 | `int GetSellPrice(string goodsKey)` | 按商品键查出售单价 |
| 购买商品 | `bool TryBuy(string goodsKey, int count)` | 走正式交易 |
| 赊账购买 | `bool TryBuyOnCredit(string goodsKey, int count)` | 借贷补全路径 |
| 出售物品 | `bool TrySellItem(string category, int count)` | 仓库物品卖出 |
| 出售模块 | `bool TrySellModule(string kind, string facing, int count)` | 仓库模块卖出 |
| 刷新货架 | `bool RefreshStock()` | 按累计天数刷新 |
| 清空赎回池 | `bool ClearRedemption()` | 出航前清理 |

### 5.4 WorkshopApi —— 车间

| API | 签名 | 说明 |
|---|---|---|
| 是否测试模式 | `bool IsTestMode()` | 直接启动场景标记 |
| 编辑区结构数量 | `int StructureCount()` | 编辑区当前结构数 |
| 编辑区模块数 | `int StructureModuleCount()` | 编辑区全部模块件数 |
| 出航校验 | `bool CanDepart(out string reason)` | 复用 `WorkshopDepartureResolver.Validate` |
| 最低供给评估 | `bool EvaluateMinimumSupply()` | 阈值判定 |
| 补足最低供给 | `int FulfillMinimumSupply()` | 借贷补全 |
| 生成船体数据 | `bool TryBuildShipData()` | 校验 + 生成快照 |

### 5.5 ShipApi —— 飞船局内

| API | 签名 | 说明 |
|---|---|---|
| 玩家飞船是否存在 | `bool HasPlayerShip()` | 名册查询 |
| 是否可运行 | `bool IsOperational()` | 有核心且未摧毁 |
| 是否已摧毁 | `bool IsDestroyed()` | 摧毁标记 |
| 模块总数 | `int ModuleCount()` | 有效模块件数 |
| 总质量 | `float TotalMass()` | 含携带物 |
| 载荷上限 | `int LoadCapacity()` | 储存模块总容量 |
| 是否含核心 | `bool HasCore()` | 核心判定 |
| 核心健康 | `int CoreHealth()` | 活核心生命值 |
| 查询货物 | `int GetCargoTotal(string category)` | 货舱按类别总数 |
| 消耗货物 | `bool TryConsume(string category, int amount)` | 就近消耗 |
| 添加货物 | `bool TryAddCargo(string category, int amount)` | 货舱添加 |
| 摧毁玩家船 | `bool DestroyPlayerShip(string reason)` | 触发摧毁流程 |

### 5.6 FlowApi —— 流程控制

| API | 签名 | 说明 |
|---|---|---|
| 获取游戏状态 | `string GetGameState()` | 状态机当前状态名 |
| 进入整理 | `bool EnterOrganizing()` | 进入整理阶段 |
| 出航 | `bool ExitOrganizingToExpedition()` | 整理→出航 |
| 进入暂停 | `bool EnterPause()` | 暂停 |
| 恢复 | `bool Resume()` | 恢复 |
| 请求结算 | `bool RequestSettlement(string destination, bool discovered)` | 结算请求 |
| 失败 | `bool Fail(string reason)` | 触发失败状态 |
| 等待结算确认 | `bool WaitingForSettlementConfirm()` | 查询 |
| 退出游戏 | `bool QuitGame()` | 退出应用 |

### 5.7 MissionApi —— 任务

| API | 签名 | 说明 |
|---|---|---|
| 是否存在任务 | `bool HasMission(string missionId)` | 任务是否已载入 |
| 获取任务状态 | `int GetMissionState(string missionId)` | 0=未激活 1=待接取 2=进行中 3=已完成 |
| 可见任务数量 | `int GetVisibleMissionCount()` | 开放可见任务数 |
| 获取任务目标描述 | `string GetObjective(string missionId)` | 目标描述文本 |
| 接取任务 | `bool AcceptMission(string missionId)` | 仅待接取可接取 |
| 任务进度 | `int GetProgress(string missionId)` | 首要目标当前进度 |
| 任务目标值 | `int GetTarget(string missionId)` | 首要目标目标值 |
| 是否待接取 | `bool IsAvailable(string missionId)` | 状态判断 |
| 是否进行中 | `bool IsInProgress(string missionId)` | 状态判断 |
| 是否已完成 | `bool IsCompleted(string missionId)` | 状态判断 |
| 获取达成结局 | `string GetCompletedEnding(string missionId)` | 达成结局 ID |

> 任务状态由 `MissionService` 承载（经 `MissionSystem` 装配），进度统计按 `GetEndingProgress` 口径：普通结局读任务级进度，独一结局读全局计数器。

---

## 6. 事件桥映射（GameEventBridge）

| 游戏事件源 | 游戏事件 | SequenceMap 事件名 |
|---|---|---|
| ShipFlowEventSource | ShipSpawned | `OnShipSpawned` |
| ShipFlowEventSource | ShipDestroyed | `OnShipDestroyed` |
| ShipFlowEventSource | DayEnded | `OnDayEnded` |
| ShipFlowEventSource | GameStateChanged | `OnGameStateChanged` |
| ShipFlowEventSource | ExpeditionCompleted | `OnExpeditionCompleted` |
| ShipFlowEventSource | CoinsChanged | `OnCoinsChanged` |
| CargoEventSource | CargoChanged | `OnCargoChanged` |
| CargoEventSource | AmmunitionConsumed | `OnAmmunitionConsumed` |
| CargoEventSource | AmmunitionInsufficient | `OnAmmunitionInsufficient` |
| CargoEventSource | EpicCargoAcquired | `OnEpicCargoAcquired` |
| CargoEventSource | CargoRevealCompleted | `OnCargoRevealCompleted` |
| MissionEventSource | MissionStateChanged | `OnMissionStateChanged` |
| MissionEventSource | MissionAccepted | `OnMissionAccepted` |
| MissionEventSource | MissionEnded | `OnMissionEnded` |
| MissionEventSource | MissionOpened | `OnMissionOpened` |
| WorkshopEventSource | StructureChanged | `OnWorkshopStructureChanged` |
| WorkshopEventSource | HullSaved | `OnWorkshopHullSaved` |
| WorkshopEventSource | HullSpawned | `OnWorkshopHullSpawned` |
| WorkshopEventSource | DepartureResolved | `OnWorkshopDepartureResolved` |
| WorkshopEventSource | ItemStowed | `OnWorkshopItemStowed` |

事件桥在场景装配期由装配器调用 `WireXxx` 完成接线；接线幂等（重复调用不产生重复转发）。

---

## 7. 开发路线

1. **第一步（已交付）**：通用 API 框架重构——核心能力层（`Modules`，类型化签名 + `[GameApi]` 元数据，无 SequenceMap 依赖）+ SequenceMap 适配层（`Adapters/SequenceMap`，扁平签名转发）+ `GameServiceLocator` / `ApiServices` / `GameApiBootstrap`
2. **第二步（已交付）**：`GraphControlService` 反向桥（激活/停止图、事件投递、变量读写、C# 监听），接入 `GameApiBootstrap`
3. **第三步（已交付）**：P0 API 覆盖 `GameApi` + `WarehouseApi` + `ShopApi` + `WorkshopApi` + `ShipApi` + `FlowApi`，`GameApiBootstrap` 统一注册服务（含常驻存档服务）并接线事件桥
4. **第四步（已交付）**：`MissionApi`（任务查询 / 接取 / 进度 / 结局）落地，任务系统接入 API 框架
5. **第五步**：刷新 SequenceMap API 面板，验证适配层 API 全部可发现、可拖入图、可生成
6. **第六步**：建流程图样例（出航主循环 / 任务推进），生成代码，PlayMode 测试
7. **第七步（系统演进）**：战斗 / 移动 / 资源 / 世界 API（P1）；游戏系统间命令/查询、UI 与自动化测试逐步改走核心能力层，向「行为可经 API 完成」演进

---

## 8. 验收标准

- [ ] `Spaceship.Game` 程序集引用 SequenceMap 后编译无错
- [ ] 核心能力层（`Modules`）无 `Spaceship.Framework.SequenceMap` 引用，签名类型化，任意 C# 代码可直接调用
- [ ] 适配层（`Adapters/SequenceMap`）为每个核心方法提供扁平签名 + 完整中文元数据（displayName / description / example / threadSafety）
- [ ] SequenceMap API 面板出现「游戏/…」分类下的全部适配层 API
- [ ] 每个适配方法返回类型符合生成器约束
- [ ] 事件桥事件名与图内 `OnXXX` 节点完全一致
- [ ] `GraphControlService` 可激活/停止图、投递事件、读写变量，且经 Locator 可解析
- [ ] `MissionApi` 可查询/接取/推进任务，任务状态与存档一致
- [ ] 流程图调用适配 API 后成功生成 C# 且编译通过
- [ ] PlayMode 测试覆盖：命令成功 / 失败分支、事件等待、服务未装配兜底
