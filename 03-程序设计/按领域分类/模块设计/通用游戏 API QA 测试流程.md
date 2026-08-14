# 通用游戏 API QA 测试流程

> 作者：AI 规划 | 创建日期：2026-08-14 | 状态：待执行
> 配套文档：`通用游戏 API 框架.md`（架构与 API 清单）
> 框架级 QA（SequenceMap 编辑器/节点/生成能力）见 `Assets/Framework/SequenceMap/document/03-usage/qa-test-flow.md`，本流程聚焦**游戏能力 API**。

本文档指导 QA / 策划 / 开发逐步验证**通用游戏 API 框架**功能是否正常，包括：

- 核心能力层（`Modules`，类型化签名）能否正确读写游戏状态；
- SequenceMap 适配层（`Adapters/SequenceMap`，扁平签名）能否在图内拖入、生成、运行；
- 事件桥（`GameEventBridge`）能否把游戏事件转发为 `OnXXX` 绑定事件；
- 反向桥（`GraphControlService`）能否驱动流程图（激活/停止/投递事件/读写变量）。

> **验证原则**：每个用例记录 `通过 / 失败 / 备注`；失败时先对照「常见失败与排查」一节，仍无法定位再上报。

---

## 1. 前置条件

执行任何用例前，确认以下环境就绪：

1. **编译通过**：Console 无红色 C# 错误。
2. **场景装配**（当前开发阶段，装配组件需手动挂载）：
   - 新建空 GameObject，挂 `GameApiBootstrap`；
   - 同物体或另一空物体挂 `GameServiceLocator`；
   - 如需验证反向桥，再挂 `GraphControlService`；
   - `GameApiBootstrap` 的引用可全部留空（Awake 自动查找并注册场景系统、接线事件桥）。
3. **准备验证图**：
   - `Assets` 右键 → `Create > Spaceship/SequenceMap/流程图`，命名如 `QA_API_Check`；
   - 场景中建空 GameObject 挂 `SequenceMapGraphRunner`，把 `QA_API_Check` 拖入 `Graph` 字段；
   - 打开 `Spaceship > SequenceMap > 窗口 > 完整工作区` 编辑该图。
4. **按场景选择验证范围**：

| 场景 | 可用系统 | 建议验证的模块 |
|---|---|---|
| `ShipTest_Map`（出航） | 流程控制器 / 世界地图 / 时间导演 / 名册 / 任务 | ShipApi、FlowApi、CombatApi、NavigationApi、ResourcesApi、WorldApi、MissionApi、GameApi |
| `ShipBuild`（休整站） | 商店 / 车间编辑服务 / 名册 / 任务 | ShopApi、WarehouseApi、WorkshopApi、MissionApi、GameApi |
| `StartMenu`（主菜单） | 存档（常驻） | GameApi（存档/经济） |

> 注意：出航场景没有商店/车间服务，`ShopApi` / `WorkshopApi` / `WarehouseApi` 的绑定仓库部分会返回 `false` / `0`（属预期兜底，非缺陷）。

---

## 2. 两条验证路径

| 路径 | 载体 | 适用对象 | 对应层 |
|---|---|---|---|
| A：SequenceMap 图内验证 | 流程图节点 + 运行 Debug | 策划 / QA（无代码） | 适配层扁平 API |
| B：C# 直接调用验证 | `QAApiVerifier` 组件或临时脚本 | 开发 | 核心层类型化 API |

- **路径 A 通用步骤**：在图中选中节点 → API 面板找到「游戏/…」分类下的功能 → 拖入节点（自动连线）→ 填参数 → 点 `Generate` 等待编译 → 进入 Play Mode → 打开 Debug 选择 Runner → 观察 Console 日志与节点高亮。
- **路径 B 通用步骤**：把 `QAApiVerifier` 挂到场景空物体 → Inspector 右键组件选择对应菜单项（如「验证-经济」）→ 在 Console 查看 `[QA]` 前缀的 PASS/FAIL 输出。

> 推荐先跑路径 B 冒烟（确认核心层正确），再跑路径 A（确认适配层与图内生成）。

---

## 3. 分模块验证用例

> 表内「操作」列给出**真实英文方法签名**（`方法名(参数)`），图内节点与 C# 直接调用均可用同一签名——适配层方法名与核心层一致（枚举参数核心层用类型化值，适配层用字符串）。参数值为**英文枚举名**（如 `"Core"`、`"Forward"`、`"Food"`），`ApiEnum` 自动解析（也接受中文标签）；商品名等数据字符串按实际配置填写。核心层类型化签名对应关系见《通用游戏 API 框架.md》第 5 节。

### 3.1 GameApi —— 存档 / 经济（任意场景）

| # | 操作 | 预期结果 |
|---|---|---|
| G-1 | `GetCoins()` | 返回当前存档金币数（>0 或 0 均合法） |
| G-2 | `AddCoins(100)` 后再次 `GetCoins()` | 第一次返回 `true`；金币比调用前多 100 |
| G-3 | `DeductCoins(99999999)` | 返回 `false`（金币不足，余额不变） |
| G-4 | `GetDebt()`；`GetTotalDays()`；`IsFirstGame()` | 返回存档对应值；类型正确 |
| G-5 | `AccumulateGlobalProgress("QA_Test", 1)` 后 `GetGlobalProgress("QA_Test")` | 累加返回 `true`；读取值 ≥ 1 |
| G-6 | `SaveNow()` | 返回 `true`（非测试模式）；存档写盘无报错 |

### 3.2 WarehouseApi —— 仓库 / 库存（休整站 `ShipBuild`）

| # | 操作 | 预期结果 |
|---|---|---|
| W-1 | `CountModules("Core", "Forward")` | 返回存档模块库存数量（≥0） |
| W-2 | `AddModules("Storage", "Right", 2)` 后 `CountModules("Storage", "Right")` | 增加返回 `true`；查询值 +2 |
| W-3 | `RemoveModules("Storage", "Right", 2)` | 返回 `true`；库存恢复原值 |
| W-4 | `CountCargo("Food")` → `AddCargo("Food", 10)` → 再 `CountCargo("Food")` | 增加返回 `true`；数量 +10 |
| W-5 | `WarehouseAddModules("Storage", "Right", 1)` 后 `CountWarehouseModules("Storage", "Right")` | 放入返回 `true`；绑定仓库数量 +1 |
| W-6 | `WarehouseTakeModules("Storage", "Right", 1)` | 返回 `true`；绑定仓库数量恢复 |
| W-7 | `WarehouseAddItems("Fuel", 5)` → `WarehouseTakeItems("Fuel", 5)` | 两次均返回 `true`；总量不变 |
| W-8 | `WarehouseExpand(2, 2)` | 返回 `true`；仓库模块格/物品格增加（可在 UI 确认） |

### 3.3 ShopApi —— 商店（休整站 `ShipBuild`）

| # | 操作 | 预期结果 |
|---|---|---|
| S-1 | `GetShelfRemaining("食物")` | 返回货架剩余库存（≥0；商品名支持显示名或资产名） |
| S-2 | `GetBuyPrice("食物")`；`GetSellPrice("食物")` | 返回正整数；购买价 ≥ 出售价通常成立 |
| S-3 | `TryBuy("食物", 1)` 后查金币与货架 | 返回 `true`；金币减少、货架剩余 -1、仓库食物 +1 |
| S-4 | `TryBuy("食物", 999999)` | 返回 `false`（金币不足或货架不足，无副作用） |
| S-5 | `TrySellItem("Food", 1)` 后查金币 | 返回 `true`；金币增加、仓库食物 -1 |
| S-6 | `TrySellModule("Storage", "Right", 1)` | 返回 `true`；金币增加、仓库模块 -1 |
| S-7 | `RefreshStock()`；`ClearRedemption()` | 均返回 `true`；无报错 |

### 3.4 WorkshopApi —— 车间（休整站 `ShipBuild`）

| # | 操作 | 预期结果 |
|---|---|---|
| WS-1 | `IsTestMode()` | 返回 `bool`（与当前启动方式一致） |
| WS-2 | `StructureCount()`；`StructureModuleCount()` | 返回编辑区当前结构数与模块件数（≥0） |
| WS-3 | `CanDepart()` | 返回 `bool`；`false` 时（不可出航）为预期，需结合 UI 提示核对原因 |
| WS-4 | `EvaluateMinimumSupply()`；`FulfillMinimumSupply()` | 评估返回 `bool`；补足返回借贷补全的数量（≥0） |
| WS-5 | `TryBuildShipData()` | 校验通过返回 `true`；失败返回 `false`（与出航校验一致） |

### 3.5 ShipApi —— 飞船局内（出航 `ShipTest_Map`）

| # | 操作 | 预期结果 |
|---|---|---|
| SH-1 | `HasPlayerShip()` | 有玩家船返回 `true` |
| SH-2 | `IsOperational()`；`IsDestroyed()`；`HasCore()` | 与玩家船实际状态一致（有核心未摧毁 → 可运行） |
| SH-3 | `ModuleCount()`；`TotalMass()`；`LoadCapacity()` | 与玩家船模块/质量/容量一致（>0） |
| SH-4 | `CoreHealth()` | 活核心生命值（>0） |
| SH-5 | `GetConsumableTotal("Fuel")` | 返回货舱可消耗燃料（≥0） |
| SH-6 | `TryConsume("Fuel", 1)` 后查询 | 返回 `true`；数量 -1 |
| SH-7 | `TryAddCargo("Fuel", 1)` 后查询 | 返回 `true`；数量恢复 |
| SH-8 | `DestroyPlayerShip("QA 测试")` | 返回 `true`；随后玩家船被摧毁（`IsDestroyed()` 为 `true`） |
| SH-9 | `ShipWidth()`；`ShipHeight()`；`ShipPosition()` | 返回正数/Vector3，与场景实际一致 |

### 3.6 FlowApi —— 流程控制（出航 `ShipTest_Map`）

| # | 操作 | 预期结果 |
|---|---|---|
| F-1 | `GetGameState()`；`IsExpeditionActive()` | 返回当前状态名（如 `Expedition`）与 `bool` |
| F-2 | `EnterOrganizing()` | 返回 `true`；状态变为 `Organizing` |
| F-3 | `ExitOrganizingToExpedition()` | 返回 `true`；状态变为 `Expedition` |
| F-4 | `EnterPause()` → `Resume()` | 均返回 `true`；游戏时间暂停后恢复 |
| F-5 | `RequestSettlement("QA星球", true)` | 返回 `true`；触发结算请求 |
| F-6 | `WaitingForSettlementConfirm()` | 结算请求后返回 `true`，否则 `false` |
| F-7 | `Fail("QA 测试失败")` | 返回 `true`；进入 `Failure` 状态 |

> ⚠️ `QuitGame()` 会退出应用，**仅在验证结束时单独执行**。

### 3.7 MissionApi —— 任务（出航 / 休整站均可）

| # | 操作 | 预期结果 |
|---|---|---|
| M-1 | `GetVisibleMissionCount()` | 返回当前开放可见任务数（≥0） |
| M-2 | `HasMission("任务ID")` | 已载入任务返回 `true`；未知 ID 返回 `false` |
| M-3 | `GetMissionState("任务ID")` | 返回 0~3 整数（0 未激活 / 1 待接取 / 2 进行中 / 3 已完成） |
| M-4 | `GetObjective("任务ID")` | 返回目标描述文本（非空） |
| M-5 | `AcceptMission("任务ID")` | 待接取任务返回 `true`；非待接取返回 `false` |
| M-6 | `GetProgress("任务ID")`；`GetTarget("任务ID")` | 进行中任务进度 < 目标值；完成后相等 |
| M-7 | `IsAvailable("任务ID")`；`IsInProgress("任务ID")`；`IsCompleted("任务ID")` | 与 `GetMissionState` 结果互斥一致 |
| M-8 | `GetCompletedEnding("任务ID")` | 未完成返回空；完成返回结局 ID |

### 3.8 CombatApi —— 战斗（出航 `ShipTest_Map`）

| # | 操作 | 预期结果 |
|---|---|---|
| C-1 | `GetRadarContactCount()`；`IsRadarEnabled()` | 返回接触数（≥0）与雷达启用状态 |
| C-2 | `TriggerImmediateScan()` | 冷却就绪返回 `true`，雷达接触数可能增加 |
| C-3 | `GetCannonCooldown01()`；`GetShieldCharge01()` | 返回 0~1 浮点（无对应模块返回 0） |
| C-4 | `TryFire()` | 有存活机炮返回 `true`；发射弹丸可见 |
| C-5 | `SetCombatEnabled(false)` → `TryFire()` | 返回 `true` 但不再发射（开关生效） |
| C-6 | `GetGrappleStatus()`；`GetGrappleProgress01()`；`IsGrappleOperating()` | 返回状态文本 / 0~1 进度 / `bool`；靠近残骸时钩爪自动工作 |
| C-7 | `SetRadarEnabled(false)` → `IsRadarEnabled()` | 返回 `false`（开关生效） |

### 3.9 NavigationApi —— 移动导航（出航 `ShipTest_Map`）

| # | 操作 | 预期结果 |
|---|---|---|
| N-1 | `SetManualInput((0, 1, 0), 0)` 后 `GetVelocity()` / `GetForwardSpeed()` | 移动指令生效；前向速度 > 0（飞船前进） |
| N-2 | `SetManualInput((0, 0, 0), 1)` 后 `GetAngularVelocity()` | 转向速度非 0（飞船转向） |
| N-3 | `Stop()` 后 `GetForwardSpeed()` | 速度趋近 0（停止生效） |
| N-4 | `IsOverloaded()` | 返回 `bool`（与载荷/容量比较一致） |
| N-5 | `GetVelocity()` | 返回 Vector3（x 侧向、y 前后） |

### 3.10 ResourcesApi —— 资源消耗（出航 `ShipTest_Map`）

| # | 操作 | 预期结果 |
|---|---|---|
| R-1 | `GetCurrentFuel()`；`GetNextFuelCost()` | 返回货舱燃料量与下次步长消耗（>0） |
| R-2 | `GetCurrentFood()`；`GetNextFoodCost()` | 返回食物量与每日消耗 |
| R-3 | `GetCurrentAmmunition()` | 返回弹药量（≥0） |
| R-4 | `GetAccumulatedDistance()`；`GetDistanceToNextSettlement()` | 移动后累计航程增加；距离 > 0 |

### 3.11 WorldApi —— 世界探索（出航 `ShipTest_Map`）

| # | 操作 | 预期结果 |
|---|---|---|
| WO-1 | `GetAsteroidCount()`；`GetSalvageCount()`；`GetEnemyCount()` | 与世界生成一致（≥0） |
| WO-2 | `GetBattlingEnemyCount()`；`GetEnemiesSeeingPlayer()` | 与敌舰实际行为一致（发现玩家 → 交战） |
| WO-3 | `GetSalvageCargoTotal("Treasure")` | 返回全部残骸携带宝藏总量（≥0） |
| WO-4 | `GetDayIndex()`；`GetDayProgress01()` | 与 UI 天数/进度条一致 |
| WO-5 | `GetSettlementDestination()`；`GetSettlementDiscoveredNewPlanet()` | 结算流程中返回目标名与是否新发现 |

---

## 4. 事件桥验证（GameEventBridge）

**目的**：验证游戏事件源广播的事实能转发为 SequenceMap `OnXXX` 绑定事件。

**准备**：出航场景（`ShipTest_Map`），`GameApiBootstrap` 已挂载并完成事件接线。在 `QA_API_Check` 图中加入事件等待节点（如 `OnCoinsChanged`）并接到日志节点。

| # | 事件 | 触发方式 | 预期结果 |
|---|---|---|---|
| E-1 | `OnCoinsChanged` | `AddCoins(10)` 或 UI 购买 | 事件节点唤醒，后继日志输出 |
| E-2 | `OnCargoChanged` | `AddCargo("Fuel", 1)` | 事件节点唤醒 |
| E-3 | `OnDayEnded` | 等待天数推进（或流程结算触发） | 事件节点唤醒 |
| E-4 | `OnShipDestroyed` | `DestroyPlayerShip("QA")` | 事件节点唤醒 |
| E-5 | `OnMissionStateChanged` / `OnMissionEnded` | `AcceptMission("任务ID")` | 事件节点唤醒 |
| E-6 | `OnWorkshopHullSaved` 等 | 休整站保存船体 | 事件节点唤醒 |

> 事件名必须与「事件桥映射」表完全一致（含大小写）。若图内等待节点不被唤醒，先检查 `GameApiBootstrap` 是否在场景且事件源已接线。

---

## 5. 反向桥验证（GraphControlService）

**目的**：验证游戏代码能主动驱动流程图。适合开发用临时脚本或 `execute_code` 调用。

**准备**：场景挂 `GraphControlService`，Runner 绑定 `QA_API_Check`（未勾选 Awake 运行）。

| # | 操作 | 预期结果 |
|---|---|---|
| GC-1 | `graphControl.Activate("QA_API_Check")` | 返回 `true`；图从 Root 开始执行 |
| GC-2 | 图内含 `OnCustomEvent == "QA_Go"` 节点；`graphControl.TriggerEvent(runner, "QA_Go")` | 定向投递；等待节点唤醒继续 |
| GC-3 | `graphControl.TriggerBindEvent("OnCoinsChanged")` | 图内 `OnCoinsChanged` 等待节点唤醒 |
| GC-4 | 图内声明 `$qaInt`(Int)；`graphControl.SetRunnerInt(runner, "qaInt", 42)` 后 `GetRunnerInt(...)` | setter 返回 `true`；getter 返回 `42` |
| GC-5 | `graphControl.SetGlobalString("qaGlobal", "hi")` 后 `GetGlobalString(...)` | 写入可读回 `"hi"` |
| GC-6 | 运行中 `graphControl.Stop(runner)` | 返回 `true`；流程停止（Debug 高亮消失） |
| GC-7 | `graphControl.Restart(runner)` | 返回 `true`；流程从头重新执行 |

---

## 6. 服务装配与兜底验证

| # | 操作 | 预期结果 |
|---|---|---|
| SB-1 | 场景无商店系统时调用 `ShopApi.GetShelfRemaining("食物")` | 返回 `0`，无异常（兜底生效） |
| SB-2 | 场景无玩家船时调用 `ShipApi.ModuleCount()` | 返回 `0`，无异常 |
| SB-3 | `GameServiceLocator.Instance` 为空时调用任意 API | 返回默认值 / `false`，无 NRE |
| SB-4 | 挂载 `GameApiBootstrap` 后重复进/出 Play | Locator 注册无重复、无报错 |

---

## 7. 发布前验收清单

- [ ] 前置条件全部就绪（编译通过、场景装配、验证图就绪）
- [ ] 路径 B 冒烟通过：`QAApiVerifier` 全部用例 PASS
- [ ] GameApi G-1~G-6 通过
- [ ] WarehouseApi W-1~W-8 通过（休整站）
- [ ] ShopApi S-1~S-7 通过（休整站）
- [ ] WorkshopApi WS-1~WS-5 通过（休整站）
- [ ] ShipApi SH-1~SH-9 通过（出航）
- [ ] FlowApi F-1~F-7 通过（出航，QuitGame 单独验证）
- [ ] MissionApi M-1~M-8 通过
- [ ] CombatApi C-1~C-7 通过（出航）
- [ ] NavigationApi N-1~N-5 通过（出航）
- [ ] ResourcesApi R-1~R-4 通过（出航）
- [ ] WorldApi WO-1~WO-5 通过（出航）
- [ ] 事件桥 E-1~E-6 通过
- [ ] 反向桥 GC-1~GC-7 通过
- [ ] 兜底 SB-1~SB-4 通过
- [ ] Console 无红色错误；SequenceMap `Problems` 无未处理错误
- [ ] 全部用例完成后：恢复默认存档/测试数据，确认不影响正式存档

---

## 8. 常见失败与排查

| 现象 | 可能原因 | 排查步骤 |
|---|---|---|
| 图内调用返回 0 / false | 对应服务未装配（商店/车间/玩家船等） | 对照第 1 节场景可用系统；确认在正确场景验证 |
| 适配层解析枚举失败（返回默认值） | 参数拼写与中文标签不一致 | 核对 `ApiEnum` 支持的中文标签；图内参数用下拉/提示 |
| 事件等待节点不唤醒 | 事件桥未接线 / 事件名不一致 | 检查 `GameApiBootstrap` 在场且事件源已挂；核对「事件桥映射」表 |
| 生成失败 / Problems 报错 | 图内变量未声明 / API 参数类型不符 | 按 Problems 定位；补声明变量或改参数 |
| 图生成后运行无反应 | Runner 未绑定图 / 未生成代码 | 检查 Runner.Graph 引用；点 `Generate` 并等编译 |
| `QuitGame` 意外触发退出 | 图中包含该节点 | 单独建图验证或最后执行 |
| API 面板看不到「游戏/…」分类 | Registry 缓存未刷新 | `Tool > 刷新 API 扫描` |
