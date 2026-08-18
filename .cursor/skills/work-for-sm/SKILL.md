---
name: work-for-sm
description: >-
  Exposes SequenceMap-composable game APIs for SpaceShip planners: primitives
  not full AI, three-layer EnemyApi/SequenceMapEnemyApi, sync vs coroutine vs
  event, void vs bool, Inspector plus node parameters, docs and QA. Use when
  the user says /work-for-sm, 给 SequenceMap 暴露 API, 供策划配置, 基本行为原语,
  行为树节点, SequenceMapEnemyApi, or asks to add enemy/ship capabilities that
  SequenceMap graphs will compose.
---

# /work-for-sm — 为 SequenceMap 暴露可拼装原语

策划用 SequenceMap 自己配复杂逻辑。程序只提供**基本行为 API**，不在 C# 里写完整 AI。

## 先读这些

1. `03-程序设计/按领域分类/规范与标准/API同步与异步规范.md`
2. `03-程序设计/按领域分类/模块设计/通用游戏 API 框架.md`
3. 相关领域文档（敌人：`非玩家单位行为树.md`）
4. 现有适配层：`d:\Unity\Spaceship\Assets\Scripts\Api\Adapters\SequenceMap\`

框架说明书：`d:\Unity\Spaceship\Assets\Framework\SequenceMap\document\04-api-and-generation\create-api-node-flow.md`

**不要改 SequenceMap 框架本体**，只在游戏 API 层加方法。

## 工作流程

复制并勾选：

```
- [ ] 1. 分类能力（查询 / 命令 / 过程 / 事件）
- [ ] 2. 拆成原语，不写完整决策
- [ ] 3. 核心层 Modules + SequenceMap 适配层
- [ ] 4. 调参：Inspector 查询 + 图节点参数可覆盖
- [ ] 5. 更新设计文档与 QAApiVerifier
- [ ] 6. 维护注释；Unity Console 无编译错误
```

未要求画图时，**不要**生成或改 `.asset` 行为树；把拼装示例写进文档即可。

### 1. 先分类再写代码

| 类型 | 核心层 | SequenceMap | 禁止 |
|---|---|---|---|
| 瞬时查询 | `bool` / `float` / `Vector3` | 原样转发 | 不要配 `WaitUntil` |
| 瞬时命令 | C# 可 `bool` | 「正常未成功」用 **void** | bool false 无失败边会停图 |
| 可变状态 | 保留同步查询 | 已满足先查；否则 `OnCustomEvent` | 不要为查询再写协程 |
| 持续过程 | `IEnumerator`，外部 timeout | 协程节点 | 只 `yield return null`；禁止 `WaitForSeconds` / `Task` |

协程：`self` 无效返回 `null`（failure）；跑完（含超时）走 success。

### 2. 原语，不要黑盒 AI

把需求拆成：感知查询、位置查询、距离判定、一拍行动、过程协程。

决策（看见还是雷达、远了靠近还是开火）留在图里。C# 可以做「远则靠近否则停」这种无分支语义的一拍，但不要内置巡逻/开火/三态。

追**移动目标**不要用调用时拍死的 `MoveTo`；每帧重取位置（一拍循环或专用协程）。

### 3. 三层（以非玩家单位为例）

```
图节点 [SequenceMapApi]
  → SequenceMapXxxApi（GameObject self，扁平签名）
  → XxxApi（类型化，不引用 SequenceMap）
  → 运行时适配器（如 EnemyShipController）
```

- 适配层 `Resolve(self)` 取组件；空引用返回默认值 / no-op，不抛异常。
- `[SequenceMapApi]`：中文显示名、分类、description、parameterDescription、returnDescription、example、`threadSafety: UnityObject`。
- 签名限：`int` `float` `bool` `string` `Vector3` `GameObject` `Transform` `Component` 及数组。`Vector2` 在适配层升为 `Vector3`。
- 对象操作用静态方法 + 对象参数，不要 `$go.Foo()`。
- 方法名避开 BaseLibrary 已有名（图内取自身位置用 `GetSelfPosition`，不要再引入与 `GetPosition(Transform)` 冲突的重载）。

### 4. 参数给策划调

同时提供：

1. 控制器 `[SerializeField]` + `GetXxx()` 查询（Prefab Inspector 调）
2. 行动 API 上的 `keepDistance` / `timeoutSeconds` 等节点参数（图内可填数字，或传入 `GetXxx($self)`）

默认值写进 Tooltip / 文档；**不要把 25、10 这种魔法数写死在 C# 决策里**。

### 5. 文档与 QA

- 设计文档 API 表、拼装示例、QA 用例同步改。
- `QAApiVerifier` 对应菜单补冒烟（查询直接断言，void 命令「已调用」即可）。
- 改脚本后用 Unity MCP `read_console` 看编译错误。

## 射击寻路（现行原语）

知道玩家（光束或雷达）→ 绕墙追踪 → 进入射击距离后不再靠近（不自动后退）。

| 节点 | 作用 |
|---|---|
| `KnowsPlayer` | `CanSeePlayer \|\| HasRadarContact` |
| `GetKnownPlayerPosition` | 照明优先，其次雷达；不知道回退本舰位置 |
| `GetShootingDistance` | 读 Inspector，默认 12 |
| `GetDistanceTo` / `IsFartherThan` | 距离查询与分支 |
| `ApproachIfFarther` | 一拍：远则绕墙靠近，近则停 |
| `ChaseKnownPlayer` | 协程：每帧追已知玩家直到进入距离 / 失去感知 / 超时 |

图内先 `KnowsPlayer` 再追踪。推荐拼装见 `非玩家单位行为树.md` 第 5.3 节。

## 验收

- 策划能只改图和参数拼出逻辑，不必再等程序加「一种敌人 AI」
- 新 API 出现在 SequenceMap 面板对应分类
- 正常未出弹、未感知等不会因 bool false 停图
- Console 无新的编译错误
