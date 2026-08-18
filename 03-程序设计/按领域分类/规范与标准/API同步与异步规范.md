# API 同步与异步规范

> 作者：AI 规划 | 创建日期：2026-08-18 | 状态：现行  
> 适用范围：`Scripts/Api` 核心能力层 + SequenceMap 适配层。雷达只是样例。  
> 上游：会议约定 + SequenceMap 内置说明书（`api-library.md` / `create-api-node-flow.md` / 用户指南「事件」章）  
> 下游：`EnemyRadarContactEventBridge`、`GameEventBridge`、各 `*Api` 的查询 / 命令 / `MoveTo`

写 API 先对照本模板分类。**不要给瞬时查询配 `WaitUntil` 协程**；状态等待走框架已有的事件节点。

---

## 1. SequenceMap 把「挂起」分成两套

说明书里原生异步语义是：`wait(seconds)`、`OnCustomEvent`、`OnXXX`、子图。协程 API（返回 `IEnumerator`）是后来补的，专门等 **本 API 自己驱动的过程做完**（案例就是 `MoveTo`）。

| 图要挂起的原因 | 用什么 | 谁负责发现「到了」 |
|---|---|---|
| 外部事实变了（联络出现、船毁、任务结束） | `OnCustomEvent == "名称"` 或 `OnXXX` | C# 边沿投递；图只用内置等待 |
| 本节点发起的过程（移动到点、播完动画） | 协程 API `IEnumerator` | 协程内部每帧推进，带外部超时 |
| 只想看现在是什么 | 同步查询 | 无挂起 |

推荐顺序：先同步查询（已经满足就别等）；否则等事件。持续移动用 `MoveTo`，不要 `MoveToward` 外挂 `Wait`。

---

## 2. 能力分类（先分类，再写代码）

| 类型 | 判定 | 核心层 | SequenceMap | 异步怎么接 |
|---|---|---|---|---|
| **瞬时查询** | 无过程（金币、联络是否存在、冷却进度） | `T Get…()` / `bool Is…()` | 原样转发 | 否。需要等变化时另接事件，不另写 WaitUntil |
| **瞬时命令** | 一帧完成 | `bool Do…()` 给 C# | 「正常未成功」会停图 → **void** | 否 |
| **可变状态** | 会变、图会等（本舰联络、看见玩家） | 同步查询必须保留 | 查询节点 | 本物体 `TriggerEvent` → `OnCustomEvent`（默认无参）；场景级走 `GameEventBridge` 的 `OnXXX` |
| **持续过程** | 移动、播放 | `IEnumerator Do…(…, timeout)` | 协程节点 | 超时由外部传入、内部打断 |

**按需**：只给「图会等它变化」的状态接线事件。商店买一次、读金币一次，不要事件也不要协程。流程 / 任务 / 船毁已有 `OnXXX`，不要再包一层 WaitUntil。

---

## 3. 事件通道（不要混）

| 范围 | 图节点 | C# 触发 | 参数 |
|---|---|---|---|
| 本物体局部（本舰雷达、本舰看见） | `OnCustomEvent == "RadarContactChanged"` | 该物体 `SequenceMapGraphRunner.TriggerEvent(name)` | **默认不传**；醒了再用同步查询看当前值 |
| 场景级事实（船毁、任务、结算） | `OnShipDestroyed` 等 | `TriggerBindEvent`（经 `GameEventBridge`） | 绑定事件不带整数 |

`TriggerEvent` 唤不醒 `OnXXX`；`TriggerBindEvent` 唤不醒 `OnCustomEvent`。

边沿只在 **false↔true 变化时** 投递，首次采样只记缓存、不发事件，避免图一进等待就被空事件叫醒。已经是目标状态时，图应先走同步查询。

---

## 4. 编写模板

### 4.1 瞬时查询

```csharp
public static bool HasRadarContact(EnemyShipController self)
    => self != null && self.TryGetRadarPlayerPosition(out _);
```

适配层 `description` 写清：同步查询；若要等变化，写对应 `OnCustomEvent` / `OnXXX` 名。

### 4.2 可变状态：查询 + 边沿事件（不要 WaitUntil）

C# 在 LateUpdate / Tick 比较上次值，变化则 `runner.TriggerEvent("RadarContactChanged")`。

图：

```text
HasRadarContact($self)          // 已经有联络则不必等
→ false → OnCustomEvent == "RadarContactChanged"
→ HasRadarContact($self)        // 醒来后读当前值
```

### 4.3 持续过程：协程 + 内置超时

只 `yield return null`，禁止 `WaitForSeconds`。返回 `null` = 立即 failure；跑完 = success（含超时）。时间参数由外部传入。

```csharp
public static IEnumerator MoveTo(self, target, allowForward, arriveDistance, timeoutSeconds)
```

### 4.4 瞬时命令：图内 void / C# bool

冷却、未命中、本帧没打出 → 适配层 `void`，避免 false 无失败边时停图。

---

## 5. 全库对照（现行）

| 模块 | 同步 | 异步（说明书路径） | 不要做的 |
|---|---|---|---|
| EnemyApi | `HasRadarContact` / `CanSeePlayer` / `MoveToward` | 本舰 `RadarContactChanged`、`PlayerVisibleChanged`；过程用 `MoveTo` | 不要 `WaitUntilRadarContact` |
| CombatApi | `IsCannonReady` / `IsGrappleOperating` / `GetRadarContactCount` | 暂无独立边沿；需要再按需接线，不要先造 WaitUntil | |
| FlowApi | `GetGameState` / `WaitingForSettlementConfirm` | `OnGameStateChanged` / `OnSettlementPending` | 不要 WaitUntilGameState |
| MissionApi | `GetMissionState` / `IsCompleted` | `OnMissionStateChanged` / `OnMissionEnded` | |
| ShipApi | `IsDestroyed` | `OnShipDestroyed` | |
| Game / Shop / Warehouse / Workshop / Resources / World | 瞬时查询与命令 | 已有金币/货物/车间 `OnXXX` | |

---

## 6. 验收

- [ ] 新 API 已按 §2 分类
- [ ] 状态等待用 `OnCustomEvent` / `OnXXX`，没有多余 WaitUntil
- [ ] 持续过程才返回 `IEnumerator`，带外部超时
- [ ] 本物体事件默认无参；通道不混用
- [ ] 图内正常未成功的命令适配为 `void`
