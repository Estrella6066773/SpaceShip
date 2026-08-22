# 非玩家单位 SequenceMap API 使用指南

> 面向：**SequenceMap 图编辑者（策划）** | 创建日期：2026-08-20 | 状态：现行  
> 程序实现细节见 [非玩家单位行为树.md](./非玩家单位行为树.md)；API 同步/异步通则见 [API同步与异步规范.md](../规范与标准/API同步与异步规范.md)

本文档说明如何通过 SequenceMap（SM）修改非玩家单位逻辑：**只改图与参数，不改 C#**。程序提供可拼装**原语**，完整 AI 由你在图里组合。

---

## 1. 五分钟上手

```text
① 确认船体根物体有 SequenceMapGraphRunner，图变量 self 绑到本舰根
② 确认 ShipBlueprint.behaviorId 与 NonPlayerUnitBehaviorConfig 资产 id 一致
③ 在 SM 编辑器打开行为树图，从 API 面板拖「游戏/非玩家单位」节点
④ 用 $self 作为首参调用 API（例：KnowsPlayer($self)）
⑤ 保存图 → 自动生成 Api/Generated/*.cs → Play 验证
```

**核心原则**

| 原则 | 说明 |
|---|---|
| 原语，非黑盒 AI | C# 只给「看见玩家」「朝坐标移动一拍」等原子能力；巡逻/追击/开火决策在图里拼 |
| 同步 / 事件 / 协程 三选一 | 查现状用同步；等变化用 `OnCustomEvent`；持续移动/追踪用带 `durationSeconds` 的协程 |
| 参数两处可调 | Prefab Inspector（巡逻半径、射击距离等）+ 图节点数字参数（可覆盖） |
| 追移动目标每帧重取坐标 | 不要用 `MoveTo` 追玩家；用 `ApproachIfFarther` 循环或 `ChaseKnownPlayer` |

---

## 2. 前置：self 与行为类型

### 2.1 图变量 `$self`

每张非玩家单位行为树应声明 `GameObject self`。在船体 `SequenceMapGraphRunner` 的「对象变量预设」里，把 `self` 绑到**本舰根物体**。图内所有 API 首参写 `$self`。

取自身位置请用 **`GetSelfPosition($self)`**（不要用可能与框架冲突的 `GetPosition` 重载）。

### 2.2 行为类型配置

| 资产 / 字段 | 作用 |
|---|---|
| `NonPlayerUnitBehaviorConfig` | `id` + `displayName` + 行为树图引用；放在 `Resources/NonPlayerUnit/{id}.asset` |
| `ShipBlueprint.behaviorId` | 导出 Prefab 时按 id 自动挂 Runner 与图 |
| `NonPlayerUnitController` Inspector | 巡逻半径、固定巡逻路线、射击距离、逃跑距离等默认值 |

新增一类单位：**手动画图 → 新建 Config 资产 → 蓝图填 id → 再导出 Prefab**。全程零 C#。详见 [非玩家单位行为树 · 新增单位类型指南](./非玩家单位行为树.md#新增单位类型指南纯配置流程)。

### 2.3 面板入口

SequenceMap API 面板分类：**「游戏/非玩家单位」**。节点中文名与下表「显示名」列一致；tooltip 含参数说明与示例。

---

## 3. 三种节点用法（必读）

| 类型 | 典型节点 | 何时用 | 图内注意 |
|---|---|---|---|
| **同步查询** | `KnowsPlayer`、`IsFartherThan`、`IsMoving` | 当前帧快照，立刻分支 | 已满足则**不必**再等事件；`IsMoving` 只表示已有脚本输入 |
| **同步命令** | `MoveToward`、`ApproachIfFarther`、`StopMove` | 一帧给输入 | 持续行为请用协程版或 `Wait`+循环 |
| **事件等待** | `OnCustomEvent == "PlayerVisibleChanged"` | 等「本舰看见玩家」边沿 | **看见玩家必须走这条**；已看见则先 `CanSeePlayer`，不必等；醒来后再查（边沿双向） |
| | `OnCustomEvent == "RadarContactChanged"` | 等「本舰雷达联络」边沿 | 同上；醒来后再查 `HasRadarContact` |
| **过程协程** | `MoveTo`、`ChaseKnownPlayer`、`FireCannon($self, 2)` | 做一段时间 | **必须**填 `durationSeconds`；有目标的节点超时未达成走 **failure** |

**不要**给查询再套 `WaitUntil` 协程。详见 [API同步与异步规范.md](../规范与标准/API同步与异步规范.md)。

### 3.1 void 与 bool 的区别（易踩坑）

| API | SM 返回值 | 原因 |
|---|---|---|
| `FireCannon($self)` | **void** | 冷却/超距/无弹是正常「本帧未出弹」；bool false 且无失败边会**停掉整图** |
| `EmitRadarWave($self)` | void | 同上 |
| `AdvancePatrol($self)` | void | 无固定路线是正常 no-op |
| `SetPatrolToNearest($self)` | void | 无固定路线是正常 no-op |
| `ClearPatrolRoute` / 路径点增删改 / 导入坐标 | void | 越界、物体为空是正常 no-op |
| 移动类 void 命令 | void | 正常 no-op，图应继续循环 |

需要「是否打出弹」时在 C# 测 `NonPlayerUnitApi.FireCannon`；图里只用 void 版。

### 3.2 持续行为与 durationSeconds

所有协程节点必填 `durationSeconds`：

- 目标提前达成（进入到达半径 / 射击距离）→ 提前结束 **success**
- 时间到仍未达成（有目标的节点）→ **failure**，请接失败边处理（如重采样巡逻点）
- `durationSeconds <= 0` → 立即结束，按是否已达成目标判定 success / failure

| 协程节点 | 提前结束（success） | 超时未达成 |
|---|---|---|
| 朝坐标移动(持续) | 无（指令就是「做满时长」） | success |
| 移动到坐标 | 进入 `arriveDistance` | **failure** |
| 远则靠近否则停止(持续) | 已进入 `keepDistance` | **failure** |
| 追踪已知玩家至射击距离 | 进入射击距离 | **failure**（失去感知也算 failure） |
| 转向坐标(持续) | 无 | success |
| 机炮开火(持续) | 无 | success |

### 3.3 抵达判定与协程完成（必读）

**抵达**：只有带距离参数的协程才有「到了」的概念；判定的是**平面距离**（XY），不要求朝向或速度已达成。

| 节点 | 距离参数 | 视为抵达 |
|---|---|---|
| `MoveTo` | `arriveDistance` | 与目标距离 ≤ `arriveDistance` |
| `ApproachIfFarther`（持续） | `keepDistance` | 不再比 `keepDistance` 更远（已进入或等于该距离） |
| `ChaseKnownPlayer` | `keepDistance` | 与已知玩家距离 ≤ `keepDistance` |

`MoveToward`（同步一拍 / 纯持续）**没有抵达判定**，只朝目标移动一帧或做满 `durationSeconds`。

**持续时间**：`durationSeconds` 由**图节点参数**填写，不是单位自动计算。时间用尽后行为会停（移动类会停推进），但图走哪条边分两类：

| 协程类型 | 代表节点 | 时间内达成目标 | 时间到仍未达成 |
|---|---|---|---|
| **有完成条件** | `MoveTo`、`ApproachIfFarther`（持续）、`ChaseKnownPlayer` | **success** | **failure**（须接失败边） |
| **纯时长** | 持续 `MoveToward`、`RotateToward`、`FireCannon` | — | **success**（做满时长即完成） |

补充：

- `durationSeconds <= 0`：立即结束；有完成条件的节点按**当前是否已达成**判定 success / failure。
- `ChaseKnownPlayer`：开始时不知道玩家 → 整节点 **failure**；追踪中失去感知 → **failure**。
- `self` 无效或协程返回 `null` → **failure**。

---

## 4. API 速查表

以下均为 `SequenceMapNonPlayerUnitApi` 节点；首参均为 `$self`（`UnspecifiedMotion()` 无 self）。

### 4.1 感知

| 方法 | 显示名 | 返回 | 说明 |
|---|---|---|---|
| `HasPlayer` | 玩家是否存在 | bool | 场景有玩家船 |
| `CanSeePlayer` | 是否看见玩家 | bool | 照明光束覆盖玩家。**等变化必须** `OnCustomEvent == "PlayerVisibleChanged"`，不要 `Wait` 轮询 |
| `HasRadar` | 是否有雷达 | bool | 有启用且未损毁雷达 |
| `HasCannon` | 是否有机炮 | bool | 有启用且未损毁机炮 |
| `HasRadarContact` | 是否有雷达联络 | bool | 雷达已记录玩家真实位置。等变化用 `OnCustomEvent == "RadarContactChanged"` |
| `KnowsPlayer` | 是否知道玩家位置 | bool | `CanSeePlayer \|\| HasRadarContact`。等变化并行等上述两个事件，不要轮询 |
| `HasNearestAlly` | 是否有指定类型队友 | bool | 参数 `allyId`：如 `"Chaser"` |

### 4.2 位置与距离

| 方法 | 显示名 | 返回 | 说明 |
|---|---|---|---|
| `GetSelfPosition` | 获取自身位置(别名) | Vector3 | **推荐**取本舰坐标 |
| `GetPosition` | 获取自身位置 | Vector3 | 与上同；注意框架同名冲突 |
| `GetPlayerPosition` | 获取玩家位置 | Vector3 | 玩家不可用回退本舰 |
| `GetKnownPlayerPosition` | 获取已知玩家位置 | Vector3 | 照明优先→雷达；**不知道时回退本舰**（距离为 0） |
| `GetRadarPlayerPosition` | 获取雷达玩家位置 | Vector3 | 无联络回退玩家位置 |
| `GetForward` | 获取自身前向 | Vector3 | 世界前向单位向量 |
| `GetFacingAngle` | 获取自身朝向角 | float | 度，与 Inspector 旋转 Z 一致 |
| `GetSpeed` | 获取当前速度 | float | 米/秒（物理速度，与「是否正在移动」不是一回事） |
| `GetAngularVelocity` | 获取当前角速度 | float | 度/秒 |
| `IsMoving` | 是否正在移动 | bool | **已有脚本推进/转向输入**。轮询发 `MoveToward` 前可先查，避免重复下指令。`StopMove` 后立即 false。物理滑行不算。`MoveTo` 不必查 |
| `GetNearestAllyPosition` | 获取最近指定类型队友位置 | Vector3 | 参数 `allyId`；不存在回退本舰 |
| `SamplePatrolTarget` | 采样巡逻目标 | Vector3 | 出生点半径内随机可达点 |
| `HasPatrolRoute` | 是否有固定巡逻路线 | bool | Inspector / 装配是否填了路径点 |
| `GetPatrolWaypointCount` | 获取巡逻路径点数量 | int | 未配置为 0 |
| `GetCurrentPatrolIndex` | 获取当前巡逻下标 | int | 控制器游标，已取模 |
| `GetNearestPatrolIndex` | 获取最近巡逻下标 | int | 平面距离最近的路径点；无路线为 0；只查不改游标 |
| `GetPatrolWaypoint` | 获取巡逻路径点 | Vector3 | 参数 `index`（内部取模）；**只返回坐标**；无路线回退出生点 |
| `GetCurrentPatrolWaypoint` | 获取当前巡逻路径点 | Vector3 | 当前点坐标 |
| `GetPatrolWaypointFacing` | 获取巡逻路径点方位 | float | 留空返回 `UnspecifiedMotion()`。**0=上，90=左，-90=右，180=下**（与旋转 Z / 舰首 `up` 相同，不是指南针 90=东） |
| `GetCurrentPatrolFacing` | 获取当前巡逻方位 | float | 留空返回 `UnspecifiedMotion()` |
| `GetPatrolWaypointSpeed` | 获取巡逻路径点速度 | float | 留空返回 `UnspecifiedMotion()` |
| `GetCurrentPatrolSpeed` | 获取当前巡逻速度 | float | 留空返回 `UnspecifiedMotion()` |
| `HasPatrolWaypointFacingAt` | 路径点是否配置了方位 | bool | 精确下标，不取模 |
| `HasPatrolWaypointSpeedAt` | 路径点是否配置了速度 | bool | 精确下标，不取模 |
| `GetEscapeDistance` | 获取逃跑距离 | float | Inspector 值，供图内向量运算 |
| `GetShootingDistance` | 获取射击距离 | float | 进入后不再靠近；可当 `keepDistance` |
| `GetPatrolArriveDistance` | 获取巡逻到达半径 | float | Inspector 路径点判定半径；可当 MoveTo 的 `arriveDistance`。选中本舰时每个路径点会画出这个圈 |
| `GetDistanceTo` | 获取到坐标距离 | float | 平面距离 |
| `IsFartherThan` | 是否远于距离 | bool | 参数 `target`、`distance` |

#### 4.2.1 巡逻路线编辑（增删改 · void）

路径点列表可在 **Inspector 预填**，也可 **完全在图里建/改**。增删改命令均为 void；越界、物体为空等正常 no-op，不会停图。

| 方法 | 显示名 | 说明 |
|---|---|---|
| `ClearPatrolRoute` | 清空巡逻路线 | 清空列表并重置游标 |
| `AddPatrolWaypoint` | 追加巡逻路径点 | 只填坐标 |
| `AddPatrolWaypoint` | 追加巡逻路径点(运动期望) | + 方位/速度；留空传 `UnspecifiedMotion()` |
| `SetPatrolWaypoint` | 设置巡逻路径点 | index=当前数量时追加，否则改已有项 |
| `SetPatrolWaypointPosition` | 设置巡逻路径点坐标 | 只改坐标 |
| `SetPatrolWaypointFacing` | 设置巡逻路径点方位 | `UnspecifiedMotion()` 清除方位 |
| `SetPatrolWaypointSpeed` | 设置巡逻路径点速度 | `UnspecifiedMotion()` 清除速度 |
| `RemovePatrolWaypoint` | 删除巡逻路径点 | 精确下标 |
| `SetCurrentPatrolIndex` | 设置当前巡逻下标 | 对数量取模 |
| `SetPatrolToNearest` | 巡逻对齐最近路径点 | 把游标设到最近点；**只在开始/恢复巡逻时调一次** |
| `ImportPatrolWaypointPosition` | 导入巡逻路径点坐标 | 从物体读 XY 写入该点 |
| `AddPatrolWaypointFromObject` | 从物体追加巡逻路径点 | 末尾追加，只含坐标 |
| `ImportPatrolPositionsFromRoot` | 从父物体导入巡逻坐标 | 子节点顺序写入/追加 |

**图内从零建一条两点来回线**（闭合循环，不依赖 Inspector）：

```text
ClearPatrolRoute($self)
AddPatrolWaypoint($self, $pointA)
AddPatrolWaypoint($self, $pointB)
SetPatrolToNearest($self)
→ [MoveTo + AdvancePatrol 循环，见 5.2]
```

### 4.3 可达与寻路

| 方法 | 显示名 | 返回 | 说明 |
|---|---|---|---|
| `IsReachable` | 是否可达 | bool | 直达射线无小行星挡（不含船体半径） |
| `HasPathTo` | 是否有绕墙路径 | bool | 按船体导航圆能否绕墙到达 |
| `GetNextPathPoint` | 获取下一路径点 | Vector3 | 刷新路径缓存；无路径退回 target |
| `GetNavigationRadius` | 获取导航半径 | float | 调试 / 自定义寻路 |

移动类 API 内部已走绕墙路径；出发前可用 `HasPathTo` 分支。

### 4.4 移动与战斗（同步一拍）

| 方法 | 显示名 | 参数要点 |
|---|---|---|
| `MoveToward` | 朝坐标移动 | `target`, `allowForward`；全向平移（可横移、倒飞），默认同时把舰首转向目标 |
| `MoveToward` | 朝坐标移动(运动期望) | + `desiredAngleDegrees`, `desiredSpeed`, `desiredAngularVelocity`；未指定传 `UnspecifiedMotion()` |
| `ApproachIfFarther` | 远则靠近否则停止 | `target`, `keepDistance`, `allowForward`；进入距离**停推进、不后退** |
| `ApproachIfFarther` | 远则靠近否则停止(运动期望) | 同上 + 运动期望 |
| `StopMove` | 停止移动 | — |
| `RotateToward` | 转向坐标 | `target` |
| `EmitRadarWave` | 发射雷达波 | void |
| `FireCannon` | 机炮开火 | void；本帧未出弹仍 success |
| `SetTarget` | 设置目标 | `target`；调试用 |
| `AdvancePatrol` | 推进巡逻路径点 | void；闭合循环：末点后回到首点；抵达当前点后再调 |
| `SetPatrolToNearest` | 巡逻对齐最近路径点 | void；开始或恢复巡逻时调一次，再 MoveTo |

### 4.5 移动与战斗（协程 · 持续）

| 方法 | 显示名 | 额外参数 |
|---|---|---|
| `MoveToward` | 朝坐标移动(持续) | `durationSeconds` |
| `MoveToward` | 朝坐标移动(持续+运动期望) | `durationSeconds` + 运动期望 |
| `MoveTo` | 移动到坐标 | `arriveDistance`, `durationSeconds` |
| `MoveTo` | 移动到坐标(运动期望) | 同上 + 运动期望 |
| `ApproachIfFarther` | 远则靠近否则停止(持续) | `keepDistance`, `allowForward`, `durationSeconds` |
| `ApproachIfFarther` | 远则靠近否则停止(持续+运动期望) | 同上 + 运动期望 |
| `ChaseKnownPlayer` | 追踪已知玩家至射击距离 | `keepDistance`, `allowForward`, `durationSeconds`；**开始时不知道玩家 → failure** |
| `ChaseKnownPlayer` | 追踪已知玩家至射击距离(运动期望) | 同上 + 运动期望 |
| `RotateToward` | 转向坐标(持续) | `target`, `durationSeconds` |
| `FireCannon` | 机炮开火(持续) | `durationSeconds` |

### 4.6 工具

| 方法 | 显示名 | 说明 |
|---|---|---|
| `UnspecifiedMotion()` | 未指定运动期望 | 运动期望长签名里「不需要这项」时传它；**不要传 0 表示省略** |

### 4.7 已废弃（勿在新图使用）

| 方法 | 说明 |
|---|---|
| `MarkState` | 已废弃；用条件分支与 `OnCustomEvent` 表达状态 |
| `GetPhaseName` | 已废弃；不再提供阶段标签查询 |

---

## 5. 常见拼装模式

### 5.1 三态循环（看见玩家必须走 CustomEvent）

**不要**用 `Wait(0.1) → CanSeePlayer` 当心跳。看见/失去玩家是可变状态：先同步查询，未看见再等 `OnCustomEvent == "PlayerVisibleChanged"`；雷达同理。边沿无参且双向（出现与消失都投），醒来后**必须再查**。本舰需挂 `NonPlayerUnitRadarContactEventBridge`。

```text
root
  → CanSeePlayer($self)                         // 已经看见则不必等
       ├─ true  → [Battle 行为链]
       └─ false → HasRadarContact($self)
                     ├─ true  → [Scan 行为链]
                     └─ false → [Normal 行为链]

并行（与上面同时挂起，负责「状态变了再分支」）：
  OnCustomEvent == "PlayerVisibleChanged"
    → CanSeePlayer($self) → 再走 Battle / 下面雷达分支
  OnCustomEvent == "RadarContactChanged"
    → HasRadarContact($self) → 再走 Scan / Normal
```

`MoveTo` 会占住所在分支直到抵达或超时。要「巡逻走到一半看见玩家就立刻去战斗」，把 `PlayerVisibleChanged` 放在**并行**分支；切状态时用 `stopflow` 停掉巡逻协程（见 5.6）。行为链若用一拍 `MoveToward`，须在该链内自己循环；不要靠感知轮询反复 Trigger 当心跳。

需要调试标签时，可在分支内 `TriggerEvent("StateBattle")` 等（图内自定义事件），**不要**再用 `MarkState`。

现成 `Chaser` / `Fleer` / `Sniper` 图仍是 `Wait(0.1)` 轮询心跳，属旧写法；新图与改感知请按本节。

### 5.2 巡逻 + 雷达搜索（Normal）

现成 `Chaser` / `Fleer` 图仍用随机采样。固定路线可在 **Inspector `patrolRoute` 预填**，也可 **完全在图里** 用 §4.2.1 的增删改 API 建路线（`ClearPatrolRoute` → `AddPatrolWaypoint` …）。选中本舰可见黄色虚线**闭合**预览，每个路径点带橙色判定圈（半径 = Inspector `patrolArriveDistance`，与 `MoveTo` 平面抵达一致）。

**默认闭合循环**：按列表顺序走点，`AdvancePatrol` 末点后回到首点（下标取模）。**一条线来回也按闭合实现**：配两个端点 A、B 即可自然形成 A→B→A→B…；若端点需要不同朝向，可在点上勾选方位，或显式配 A→B→A 三点闭合。

**开始或恢复巡逻先贴最近点**：进入巡逻（首次出发、从战斗/追击回来）时先调 `SetPatrolToNearest`，再 `MoveTo` 当前点。距离按平面 XY，平局取更小下标。**不要把对齐放进每圈行走循环**，否则会反复贴最近点，走不成 A→B→C→D。

**固定路线、闭合循环**（推荐哨兵 / 有预设路线的单位）：

```text
HasPatrolRoute($self)
  ├─ true  → SetPatrolToNearest($self)          // 仅入口：开始或恢复时对齐最近点
  │            → [行走循环]
  │              MoveTo($self, GetCurrentPatrolWaypoint($self), true, GetPatrolArriveDistance($self), 8,
  │                GetCurrentPatrolFacing($self), GetCurrentPatrolSpeed($self), UnspecifiedMotion())
  │                ├─ success → AdvancePatrol($self) → EmitRadarWave($self) → Goto(行走循环)
  │                └─ failure → Goto(行走循环)    // 超时未进判定圈须接失败边；不推进下标
  └─ false → MoveToward($self, SamplePatrolTarget($self), true)
               → Wait(1) → EmitRadarWave($self) → Goto(循环首)
```

留空的方位/速度会返回 `UnspecifiedMotion()`，MoveTo 长签名会忽略该项；**不填速度则用敌人自身性能**。不要填 `0` 表示省略。**都填时朝向优先于速度**（导航层先转向、再缩放平移速度）。

**一条线来回（两点闭合）**：Inspector 只填两个端点坐标，图用上面同一套入口对齐 + `MoveTo` + `AdvancePatrol` 即可，无需单独 ping-pong 节点。

也可自持图变量 `$index`，不依赖控制器游标。开始/恢复时用 `GetNearestPatrolIndex` 赋给 `$index`：

```text
$index = GetNearestPatrolIndex($self)
$point = GetPatrolWaypoint($self, $index)
MoveTo($self, $point, true, GetPatrolArriveDistance($self), 8)
  ├─ success → $index = $index + 1 → EmitRadarWave($self) → Goto(行走循环)
  └─ failure → Goto(行走循环)
```

> `GetPatrolWaypoint` 内部对数量取模，`$index` 不必在图里自己做循环。追击打断后再回巡逻：重新赋 `$index = GetNearestPatrolIndex($self)`（或再调 `SetPatrolToNearest`），不要沿用打断前的下标。

**随机点、每轮移动一拍**（Chaser / Fleer Normal 同款）：

```text
MoveToward($self, SamplePatrolTarget($self), true)
  → Wait(1)
  → EmitRadarWave($self)
  → Goto(循环首)
```

若用更长 `Wait` 轮询、又不想重复写入 sticky 输入，先查 `IsMoving`：

```text
IsMoving($self)
  ├─ true  → （已有推进/转向指令，跳过）
  └─ false → MoveToward($self, $target, true)
```

`MoveTo` / 持续 `MoveToward` **不必**套 `IsMoving`：节点占住，内部每帧自己给输入。追会动的目标也不要用这扇门，否则绕墙路径不再刷新。

**固定点或随机点，须进入范围才算到**（`MoveTo`）：

```text
$target = SamplePatrolTarget($self)    // 或图变量 $patrolPoint
MoveTo($self, $target, true, GetPatrolArriveDistance($self), 8)   // 半径读 Inspector；8=最长秒
  ├─ success → EmitRadarWave($self) → 下一巡逻点 / Goto(循环首)
  └─ failure → 重采样 / 跳过 / Goto(循环首)   // 超时未进入 2 米内须接失败边
```

**只走一段时间、不管到没到**（持续 `MoveToward`）：

```text
MoveToward($self, SamplePatrolTarget($self), true, 5)   // 5 秒，时间到 success
  → EmitRadarWave($self) → Goto(循环首)
```

### 5.3 追击玩家（Scan / Battle）

| 场景 | 推荐 |
|---|---|
| 看见玩家，撞击 | `MoveToward($self, GetPlayerPosition($self), true)` 每轮循环 |
| 仅有雷达联络 | `MoveToward($self, GetRadarPlayerPosition($self), true)` |
| 知道玩家且要保持射击距离 | 见 5.4 |

### 5.4 射击寻路（Sniper 等）

**语义**：知道玩家 → 绕墙靠近 → 进入射击距离后**不再靠近**（不自动后退）。

同步循环（可与转向、开火并列）：

```text
KnowsPlayer($self)                              // 已经知道则不必等
  ├─ true  → ApproachIfFarther($self, GetKnownPlayerPosition($self), GetShootingDistance($self), true)
  │          → RotateToward($self, GetKnownPlayerPosition($self))
  │          → FireCannon($self)
  │          → Wait(0.1) → Goto(追踪循环)       // 此处 Wait 只节流开火/靠近，不是在等「看见」
  └─ false → [巡逻]
              并行等 PlayerVisibleChanged / RadarContactChanged
              → 再查 KnowsPlayer / CanSeePlayer / HasRadarContact
```

过程节点（玩家会动，**不要**对玩家用 `MoveTo` 单次快照）：

```text
KnowsPlayer($self)
  ├─ true  → ChaseKnownPlayer($self, GetShootingDistance($self), true, 8)
  │            ├─ success → RotateToward($self, GetKnownPlayerPosition($self))
  │            │            → FireCannon($self, 2)
  │            └─ failure（失去感知或超时）→ 巡逻 / 发雷达…
  └─ false → 巡逻
              并行：OnCustomEvent == "PlayerVisibleChanged" / "RadarContactChanged"
              → 再查后进入追踪（ChaseKnownPlayer 占住分支时，靠并行事件 + stopflow 打断）
```

细分支（远靠近 / 近开火）：

```text
IsFartherThan($self, GetKnownPlayerPosition($self), GetShootingDistance($self))
  ├─ true  → MoveToward($self, GetKnownPlayerPosition($self), true)
  └─ false → StopMove($self) → RotateToward(...) → FireCannon($self)
```

> 追踪前必须先 `KnowsPlayer`（或 `CanSeePlayer` / `HasRadarContact`）。否则 `GetKnownPlayerPosition` 回退本舰位置，会误以为「已在目标旁」。

### 5.5 逃跑（Fleer Battle）

方向运算在图内用数学库完成（无 C# 决策）：

```text
$fleeAnchor = GetNearestAllyPosition($self, "Chaser")
$fleeDir    = VectorSubtract($fleeAnchor, GetPlayerPosition($self))
$fleeLen    = VectorMagnitude($fleeDir)
  → $fleeLen < 0.001 ? $fleeDir = GetForward($self) : $fleeDir = VectorNormalize($fleeDir)
$fleeTarget = VectorAdd($fleeAnchor, VectorMultiply($fleeDir, GetEscapeDistance($self)))
MoveToward($self, $fleeTarget, true)
```

### 5.6 等看见玩家 / 雷达联络（CustomEvent，新图必用）

看见玩家与雷达联络都是可变状态，**同一套写法**。本舰需挂 `NonPlayerUnitRadarContactEventBridge`（导出 Prefab 时自动装配）。

```text
CanSeePlayer($self)             // 已经看见则不必等
  └─ false → OnCustomEvent == "PlayerVisibleChanged"
               → CanSeePlayer($self) → [Battle 行为]

HasRadarContact($self)          // 已有则跳过等待
  └─ false → OnCustomEvent == "RadarContactChanged"
               → HasRadarContact($self) → [Scan 行为]
```

打断正在专注的 `MoveTo`（巡逻走到一半看见玩家）。**回巡逻时从入口再走一遍**（含 `SetPatrolToNearest`），不要直接 Goto 行走循环：

```text
并行：
  A: MoveTo($self, GetCurrentPatrolWaypoint($self), true, GetPatrolArriveDistance($self), 8, …)
       ├─ success → AdvancePatrol → 下一轮
       └─ failure → 重采样 / 下一轮
  B: CanSeePlayer($self)
       ├─ true  → stopflow(A) → [Battle] → 回巡逻：SetPatrolToNearest → [行走循环]
       └─ false → OnCustomEvent == "PlayerVisibleChanged"
                    → CanSeePlayer($self)
                         ├─ true  → stopflow(A) → [Battle] → 回巡逻：SetPatrolToNearest → [行走循环]
                         └─ false → 继续等（这次边沿是「失去」，巡逻可不管）
```

不要用 `WaitUntilCanSeePlayer` 协程，也不要用 `Wait` + `CanSeePlayer` 轮询代替 B。

---

## 6. 参数调优

| 参数 | Inspector 字段 | 图内覆盖示例 |
|---|---|---|
| 射击距离 | `ShootingDistance`（默认 12） | `GetShootingDistance($self)` 或写死 `12` |
| 巡逻半径 | `WalkRadius` | 影响 `SamplePatrolTarget` |
| 固定巡逻路线 | `patrolRoute` 或图内增删改 API | `ClearPatrolRoute` / `AddPatrolWaypoint` / `SetPatrolWaypoint*` / 开始恢复时 `SetPatrolToNearest` / `GetCurrentPatrolWaypoint` + `AdvancePatrol` |
| 路径点判定半径 | `patrolArriveDistance`（默认 2） | `GetPatrolArriveDistance($self)` 或写死 `2`；选中本舰时每个路径点画出该圈 |
| 逃跑距离 | `EscapeDistance` | `GetEscapeDistance($self)` |
| 保持追踪距离 | — | `ApproachIfFarther` / `ChaseKnownPlayer` 的 `keepDistance` |
| 移动最长时长 | — | 协程的 `durationSeconds`（图内填写，非自动计算） |

**不要把魔法数写进 C#**；调参改 Inspector 或图节点即可。

### 6.1 运动期望（可选）

长签名移动节点可指定期望朝向角 / 速度 / 角速度：

```text
MoveToward($self, $target, true, UnspecifiedMotion(), 4, UnspecifiedMotion())
```

- 不需要的项传 `UnspecifiedMotion()`  
- `0` 表示「期望就是 0」，不是省略  
- 抵达成功只看距离，不要求朝向或速度已达成  
- **都填时朝向优先于速度**（先转向、再缩放平移速度）
- **平移与朝向独立**（飞船全向）：飞向目标时可横移、倒飞；路径点方位只转舰首，不挡去路。`allowForward=false` 时去掉前向推进，仍可横移和倒飞。
- **方位角约定**（与 Inspector 旋转 Z、舰首 `transform.up` 相同）：`0` = 世界 +Y（上），`90` = 世界 −X（左），`-90` 或 `270` = 世界 +X（右），`180` = 世界 −Y（下）。不要按指南针「90=东」来填。场景里选中本舰时，路径点上的黄色短线就是这个方向。从坐标源物体导入**只写 XY，不带旋转**。

---

## 7. 与数学库配合

逃跑方向、偏移锚点等向量运算使用 SequenceMap 数学库（非本 API）：

`VectorSubtract` · `VectorAdd` · `VectorMultiply` · `VectorNormalize` · `VectorMagnitude`

队友类型用字符串 id：`GetNearestAllyPosition($self, "Chaser")`，不要写死枚举。

---

## 8. 验收与排障

| 检查 | 做法 |
|---|---|
| API 冒烟 | 场景挂 `QAApiVerifier` → 右键「验证-非玩家单位 API」 |
| 行为回归 | 右键「验证-非玩家单位行为」 |
| 编译 | Unity Console 无红错；保存图后 `Api/Generated/*.cs` 已更新 |

| 现象 | 排查 |
|---|---|
| 单位不动 | `behaviorId` 为空、`Runner` 未启用、`self` 未绑定、`ActionsEnabled` 关闭 |
| 填了巡逻路线却仍乱走 | 现成 Chaser/Fleer 图仍调 `SamplePatrolTarget`；须按 5.2 改成入口 `SetPatrolToNearest` + `GetCurrentPatrolWaypoint` + 方位/速度 + `AdvancePatrol` |
| 巡逻总贴同一个点 | `SetPatrolToNearest` 被放进每圈行走循环；只应在开始或从战斗恢复时调一次 |
| 移动时舰首不朝去路 | 全向平移属预期。没填路径点方位时舰首会转向目标；填了方位则舰首跟箭头，去路仍飞向目标（可倒飞、侧飞） |
| 黄色虚线 / 橙色判定圈看不到 | 选中本舰；`drawPatrolRouteGizmos` 开启；`patrolRoute` 至少 1 个点。圈半径跟 `patrolArriveDistance` |
| 拖了场景物体但方位/速度没跟上 | 物体只导入 XY；方位、速度要在该条 `PatrolWaypoint` 上勾选填写 |
| 青色路径看不到 | `drawPathGizmos` 开启且正在朝某目标绕墙移动（运行时才有导航缓存） |
| 面板无「游戏/非玩家单位」 | 刷新 SequenceMap API 扫描 |
| 图跑一段就停 | 检查 bool 节点是否缺失败边；`FireCannon` 是否误用 bool 版 |
| 未看见玩家却追过去 | 是否未先 `KnowsPlayer` 就用 `GetKnownPlayerPosition` |
| 看见玩家反应慢 / `MoveTo` 走完才追 | 是否用 `Wait` 轮询 `CanSeePlayer`；改用并行 `OnCustomEvent == "PlayerVisibleChanged"`，切状态 `stopflow` 巡逻协程 |
| 轮询 `MoveToward` 却原地打转 / 不刷新路径 | 是否用 `IsMoving` 挡住了每拍输入；追移动目标或绕墙请每拍重发，或改用 `MoveTo` / `ChaseKnownPlayer` |
| 追不上移动中的玩家 | 是否误用 `MoveTo` 单次坐标；改用 `ChaseKnownPlayer` 或循环 `ApproachIfFarther` |
| `MoveTo` 超时后图停住 | 有完成条件的协程超时走 **failure**；须从失败边接重采样 / 下一逻辑，不要只连 success |
| 以为「到了」但没换点 | `MoveToward` 无抵达判定；要进范围请用 `MoveTo` 并设 `arriveDistance` |

更多装配与 QA 见 [非玩家单位行为树 · 第 9 节](./非玩家单位行为树.md#9-qa-测试指引)。

---

## 9. 相关文档

| 文档 | 用途 |
|---|---|
| [非玩家单位行为树.md](./非玩家单位行为树.md) | 架构、装配路径、Chaser/Fleer 图结构、程序侧实现 |
| [API同步与异步规范.md](../规范与标准/API同步与异步规范.md) | 同步 / 事件 / 协程 全库规范 |
| [API 框架.md](./API%20框架.md) | API 两层架构与 SequenceMap 接入 |
| `Assets/Framework/SequenceMap/document/04-api-and-generation/create-api-node-flow.md` | 新增 API 节点（程序） |

**代码入口（程序查阅）**

- SM 适配层：`Assets/Scripts/Api/Adapters/SequenceMap/SequenceMapNonPlayerUnitApi.cs`  
- 核心层：`Assets/Scripts/Api/Modules/NonPlayerUnitApi.cs`  
- 示例图：`Assets/Scripts/Gameplay/NonPlayerUnits/NonPlayerUnitBehavior/Graphs/`
