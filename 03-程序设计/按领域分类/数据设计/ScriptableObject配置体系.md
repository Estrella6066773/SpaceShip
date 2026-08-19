# ScriptableObject 配置体系（重组后）

> 最后修改：2026-08-11 | 配置体系重组完成

本文档记录重组后的全部 ScriptableObject 配置资产的参数职责边界与生效时机。

---

## 整体结构

```
SpaceshipGameConfiguration (顶层总配置)
├── SpaceshipWorldRules         # 世界规则（地图/日循环/视野/碰撞）
├── PlayerShipSettings          # 玩家飞船行为（仅保留拆卸/摄像参数）
├── LinkRulesConfig             # 局内链接规则（锚点判定/弹簧/判定容差/视觉）
├── SpaceshipPresentationConfig # 表现配置（字体/语言）
├── ShipBlueprint[]             # 飞船蓝图
└── ShipResourceConsumptionConfig # 资源消耗规则
```

---

## 资产职责与参数清单

### 1. ModuleDefinition — 模块定义

**路径**：`Data/ScriptableObjects/Spaceship/Modules/`

**职责**：定义飞船模块的静态属性。运行时经 `ConfigurePrototype` 方法按种类分配不同功能字段。

**生效时机**：编辑器资产（构建时快照）；运行时不修改。

| 参数 | 适用模块 | 说明 |
|------|---------|------|
| `displayName` | 全部 | 模块显示名称 |
| `kind` | 全部 | 模块类型 |
| `mass` | 全部 | 物理质量（影响碰撞与惯性） |
| `maxHealth` | 全部 | 最大生命值 |
| `facing` | 有方向模块 | Prefab 的初始功能朝向 |
| `frontLinkEnabled` ... `leftLinkEnabled` | 全部 | 四向链接锚点开关 |
| `loadCapacity` | Core / Thruster | 模块提供的装载上限 |
| `baseForwardSpeed` | **仅 Core** | 核心模块基础前进速度（m/s） |
| `baseBackwardSpeed` | **仅 Core** | 核心模块基础后退速度（m/s） |
| `baseTurnSpeed` | **仅 Core** | 核心模块基础转会速度（°/s） |
| `acceleration` | **仅 Core** | 线加速度（m/s²） |
| `angularAcceleration` | **仅 Core** | 角加速度（°/s²） |
| `linearDrag` | **仅 Core** | 线拖拽（自然减速） |
| `angularDrag` | **仅 Core** | 角拖拽 |
| `minimumSpeed` | **仅 Core** | 最低速度（m/s） |
| `overloadSpeedMultiplierPerModule` | **仅 Core** | 每超载模块的速度衰减倍率 |
| `forwardSpeedBonus` | Thruster | 动力模块在推力方向上的速度增益 |
| `radarRange` / `radarCooldown` | Radar | 寻敌雷达半径与冷却 |
| `lightAngle` / `lightRange` ... | Light | 发散光束（手电筒）参数 |
| `ammunitionPerShot` / `weaponRange` ... | Cannon | 机炮射程/伤害/冷却/弹丸 |
| `grappleRange` / `grappleCooldown` / `grappleActionDuration` / `grappleHalfAngle` | Grapple | 钩爪工作范围与瞄准半角 |
| `shieldCapacity` / `shieldReflectionCost` ... | Shield | 电磁盾容量/消耗/回收 |

---

### 2. LinkRulesConfig — 链接规则配置

**路径**：局内版 `Configs/Game/链接规则配置.asset`，车间版 `Configs/Workshop/链接规则配置.asset`

**职责**：集中管理模块间链接贴合的全部物理与视觉参数。局内与车间各一份独立资产。

**生效时机**：装配期快照（修改后重新进入场景或重建飞船生效）。

| 分组 | 参数 | 说明 |
|------|------|------|
| 锚点判定 | `anchorCollisionBoxSize` | 四向碰撞盒尺寸 |
| | `maxAngleError` | 两接触面法线最大角度误差（度） |
| | `linkSnapDistance` | 两接触面中心最大间距（米） |
| 贴合计时 | `normalLinkDuration` | 建立链接所需持续贴合时间（秒） |
| | `recentDetachLinkDuration` | 刚拆下重连所需缩短时长（秒） |
| | `seatedSeparationTolerance` | 计时期间允许的锚点间距上限（米） |
| 贴合弹簧 | `seatSpringStiffness` / `seatSpringDamping` | 线弹簧刚度/阻尼（质量归一后） |
| | `seatAngularStiffness` / `seatAngularDamping` | 角弹簧刚度/阻尼 |
| | `seatTemporaryLinearDamping` / `seatTemporaryAngularDamping` | 贴合期间临时提高的阻尼 |
| 判定死区 | `seatSpringZeroDistance` / `seatAngularDeadzone` | 误差低于此值时弹簧力为 0 |
| | `seatPositionTolerance` / `seatAngleTolerance` / `seatVelocityTolerance` | 判定已贴合的三重容差 |
| 视觉反馈 | `linkLineWidth` | 引导线宽度 |
| | `availableAnchorColor` / `candidateAnchorColor` | 空闲/候选锚点颜色 |

---

### 3. PlayerShipSettings — 玩家飞船行为配置

**路径**：`Configs/Game/玩家设置.asset`

**职责**：仅保留玩家交互专属参数（拆卸/摄像）。移动参数全部迁移至核心模块定义，链接参数全部迁移至 `LinkRulesConfig`。

**生效时机**：装配期快照。

| 参数 | 说明 |
|------|------|
| `detachHoldDuration` | 长按拆卸持续时间（秒） |
| `detachPointerTolerance` | 拆卸时指针偏离模块的容差距离（米） |
| `cameraRotationFollowSpeed` | 摄像机旋转跟随速度 |

---

### 4. SpaceshipWorldRules — 世界规则

**路径**：`Configs/Game/飞船世界规则.asset`

**职责**：地图、日循环、雷达/视野、碰撞物理、小行星生成、残骸拖拽、镜头抖动。

| 分组 | 参数 | 说明 |
|------|------|------|
| 地图 | `MapWidth`, `MapHeight`, `MapBorderThickness` | 世界地图尺寸与边界 |
| 日循环 | `DaySeconds` | 一天真实秒数 |
| 雷达/视野 | `defaultRadarRadius`, `visionMaskRadius`, `sensorUpdateInterval` | 默认雷达半径、视野遮罩、传感器刷新间隔 |
| 小行星 | `asteroidGroupSpawnPerRadius`, `asteroidBaseCount` | 小行星生成密度与基数 |
| 碰撞 | `collisionBaseDamage`, `collisionDamageMultiplierMass` | 碰撞伤害基础值与质量系数 |
| 残骸 | `derelictLinearDrag` | 残骸线性阻尼（防止残骸永远漂流） |
| 镜头 | `shakeDuration`, `shakeMagnitude` | 碰撞时镜头抖动参数 |

---

### 5. ShipResourceConsumptionConfig — 资源消耗配置

**路径**：内嵌于 `SpaceshipGameConfiguration` 或独立引用。

| 参数 | 说明 |
|------|------|
| `fuelPer100Meters` | 每百米燃油消耗 |
| `foodPerDay` | 船员每人每天食物消耗 |
| `ammunitionPerShot` | 每次射击弹药消耗（注：实例层数量由 `ModuleDefinition.ammunitionPerShot` 最终控制） |

---

### 6. WorkshopEditorConfig — 车间编辑配置

**路径**：`Configs/Workshop/车间编辑配置.asset`

| 分组 | 参数 | 说明 |
|------|------|------|
| 边界 | `BoundsHalfWidth`, `BoundsHalfHeight`, `BoundaryWallThickness` | 编辑区边界尺寸 |
| 链接 | `linkRulesConfig` | 引用车间专用链接规则配置 |
| 结构 | `StructureAngularDamping`, `CenterOfMassBlendSpeed` | 结构刚体的角阻尼与质心融合速度 |
| 沉降 | `SettleLinearDamping`, `SettleAngularDamping` | 结构沉降时的阻尼 |

---

### 7. ShipWorkshopLibrary — 工坊资料库

**路径**：`Configs/Game/飞船工坊资料库.asset`

引用：`worldRules`、`playerSettings`、`presentationConfig`、`linkRulesConfig`

---

### 8. SpaceshipGameConfiguration — 游戏总配置

**路径**：`Configs/Game/飞船游戏总配置.asset`

组合全部子配置的顶层入口。新增字段 `linkRulesConfig`（局内版链接规则）。

---

## 参数职责迁移对照

| 旧参数 | 原位置 | 新位置 |
|--------|--------|--------|
| `baseForwardSpeed` 等移动参数 | `PlayerShipSettings` / `WorldRules` | `ModuleDefinition.Core` |
| `OverloadSpeedMultiplierPerModule` | `PlayerShipSettings` | `ModuleDefinition.Core` |
| `LinkAnchorCollisionBoxSize` 等链接参数 | `PlayerShipSettings` | `LinkRulesConfig` |
| `AnchorCollisionBoxSize` 等链接参数 | `WorkshopEditorConfig` | `LinkRulesConfig`（workshop） |
| `grappleHalfAngle` | `PlayerShipSettings` | `ModuleDefinition.Grapple` |
| `fuelPer100Meters`（模块层） | `ModuleDefinition` | 删除（统一由 `ShipResourceConsumptionConfig` 控制） |
| `turnSpeedBonus` | `ModuleDefinition` | 删除（Thruster 速度统一为 `forwardSpeedBonus`） |
| `EnemyRadarIntervalMin/Max` | `WorldRules` | 删除（非玩家单位雷达由传感器系统自行管理） |
| `foodPerDay` | `WorldRules` | `ShipResourceConsumptionConfig` |
| `ammunitionPerShot` | `ShipResourceConsumptionConfig` | `ModuleDefinition.Cannon` |
| `description` | `CargoItemDefinition` | 删除（前端文本由本地化表管理） |
| `boundWarehouse` | `ShopDefinition` | 删除 |
| `boundExtractionPoints` | `WarehouseDefinition` | 删除 |
| `resourceConfig` | `ShipWorkshopLibrary` | 删除 |
