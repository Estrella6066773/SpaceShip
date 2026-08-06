# ScriptableObject 配置体系

> 作者：代码分析生成 | 创建日期：2026-07-29 | 最后修改：2026-08-02

本文档描述 Spaceship 项目的 ScriptableObject 数据驱动配置体系。

---

## 配置架构

项目采用**组合式配置**模式：一个顶层配置文件组合多个子配置，运行时通过 `SpaceshipGameManager` 单次读取。

```
SpaceshipGameConfiguration (顶层)
├── SpaceshipWorldRules        # 世界规则
├── PlayerShipSettings         # 玩家飞船行为
├── SpaceshipPresentationConfig # 表现配置（字体/语言）
├── ShipBlueprint[]            # 飞船蓝图（玩家/敌人，内嵌初始货物与模块布局）
└── 随机残骸组数               # 世界生成参数
```

### 配置层次

| 层次 | 资产类型 | 实例数 | 编辑器可见 |
|------|----------|--------|-----------|
| 顶层组合 | `SpaceshipGameConfiguration` | 1 个 | 是（Inspector 完整可见） |
| 子配置 | `SpaceshipWorldRules` 等 | 4 个 | 是 |
| 蓝图定义 | `ShipBlueprint` | 5 个 | 是 |
| 模块定义 | `ModuleDefinition` | 9 个 | 是 |
| 货物定义 | `CargoItemDefinition` | 多个 | 是 |

---

## 配置资产清单

### 顶层配置

| 资产 | 路径 | 职责 |
|------|------|------|
| `飞船游戏总配置` | `Data/ScriptableObjects/Spaceship/Configs/` | 组合所有子配置为一体，含 `IsValid` 全链校验 |

### 子配置

| 资产 | 路径 | 核心参数 |
|------|------|----------|
| `飞船世界规则` | 同上 | 地图尺寸、日循环（含 `FoodPerDay`）、默认移动规则、视野/雷达、小行星、碰撞与残骸 |
| `玩家飞船行为配置` | 同上 | 移动、链接（锚点碰撞盒/链接/拆除时长）、反馈、钩爪半角、相机跟随 |
| `飞船表现配置` | 同上 | 中文字体、界面语言、显示配置 |
| `飞船工坊资料库` | 同上 | 世界规则 + 玩家配置 + 表现配置 + 已保存蓝图列表 |

### 飞船蓝图

| 资产 | 对应 Prefab | 阵营 |
|------|------------|------|
| `玩家飞船` | `玩家飞船.prefab` | Player |
| `玩家新飞船` | `玩家新飞船.prefab` | Player |
| `敌人新飞船` | `敌人新飞船.prefab` | Enemy |
| `敌人新飞船 1` | `敌人新飞船 1.prefab` | Enemy |
| `敌人3` | `敌人3.prefab` | Enemy |

### 模块定义

| 资产 | 对应 Prefab | ModuleKind |
|------|------------|------------|
| `核心模块` | 同名 .prefab | Core |
| `动力模块` | 同名 .prefab | Thruster |
| `固定式机炮` | 同名 .prefab | Cannon |
| `寻敌雷达` | 同名 .prefab | Radar |
| `发散光束` | 同名 .prefab | Light |
| `电磁盾` | 同名 .prefab | Shield |
| `储存模块` | 同名 .prefab | Storage |
| `拆卸钩爪` | 同名 .prefab | Grapple |
| `基础模块` | — | Empty |

---

## ModuleDefinition 数据结构

```csharp
[CreateAssetMenu(menuName = "...")]
public class ModuleDefinition : ScriptableObject
{
    public ModuleKind kind;
    public string displayName;        // 中文显示名
    public float mass;                // 质量（影响飞船总质量与质心）
    public float maxHealth;           // 最大生命值
    public GameObject prefabReference;// 对应 Prefab 引用
    public float thrusterSpeed;       // 动力模块推进速度（= Max(forwardSpeedBonus, turnSpeedBonus)）
    public ModuleFunctionConfig[] functions; // 功能配置
    // ...
}
```

### ModuleKind 枚举

| 值 | 中文 |
|----|------|
| `Empty` | 基础模块 |
| `Core` | 核心模块 |
| `Thruster` | 动力模块 |
| `Radar` | 寻敌雷达 |
| `Light` | 发散光束 |
| `Cannon` | 固定式机炮 |
| `Grapple` | 拆卸钩爪 |
| `Shield` | 电磁盾 |
| `Storage` | 储存模块 |

### LocalDirection 枚举

| 值 | 含义 | 网格偏移 |
|----|------|----------|
| `Forward` | 前方 | (0, +1) |
| `Right` | 右侧 | (+1, 0) |
| `Back` | 后方 | (0, -1) |
| `Left` | 左侧 | (-1, 0) |

### ShipFaction 枚举

| 值 | 含义 |
|----|------|
| `Derelict` | 残骸 |
| `Player` | 玩家 |
| `Enemy` | 敌人 |
| `Neutral` | 中立 |

---

## ShipBlueprint 数据结构

```csharp
public class ShipBlueprint : ScriptableObject
{
    public string shipName;                          // 飞船名称
    public ShipFaction faction;                      // 阵营
    public ShipModulePlacement[] modulePlacements;   // 模块布局
    public ShipInitialCargoPlacement[] initialCargo; // 初始货物
    public GameObject exportedPrefab;                // 导出预制体引用
}
```

### ShipModulePlacement

| 字段 | 类型 | 说明 |
|------|------|------|
| `moduleDefinition` | `ModuleDefinition` | 模块定义引用 |
| `gridX` | `int` | 网格 X 坐标 |
| `gridY` | `int` | 网格 Y 坐标 |
| `quarterTurns` | `int` | 四分之一圈旋转 |

### ShipInitialCargoPlacement

| 字段 | 类型 | 说明 |
|------|------|------|
| `cargoType` | `CargoType` | 货物类型 |
| `count` | `int` | 初始数量 |
| `targetStorageIndex` | `int` | 目标储存模块索引 |

蓝图提供 `IsValid` / `ValidateInitialCargo` / `IsLayoutConnected` 静态校验。

---

## SpaceshipWorldRules 数据结构

| 参数分类 | 参数 | 说明 |
|----------|------|------|
| **地图** | `mapWidth`、`mapHeight` | 500m × 500m |
| **日循环** | `dayDurationSeconds` | 日时长（可配置） |
| **日消耗** | `foodPerDay` | 每日能源消耗（默认 5） |
| **默认移动** | 基础速度/阻力/角阻尼 | 敌舰等非玩家船使用的移动参数 |
| **视野** | `baseVisionRadius`、`lightAngle`、`lightRange` | 视野范围/60°/80m |
| **雷达** | `radarRange`、`radarExpiryTime` | 100m 扫描 |
| **小行星** | `asteroidCountMin`、`asteroidCountMax`、`asteroidSizeMin`、`asteroidSizeMax` | 20-30 个 / 2-8m |
| **碰撞与残骸** | `collisionDamageMultiplier`、弹/摩擦/阻尼/震屏阈值 | 碰撞伤害系数与残骸参数 |

---

## CargoItemDefinition 与货物枚举

### 货物分类体系（新）

| 枚举 | 值 |
|------|-----|
| `CargoCategory` | Food / Fuel / Ammunition / Treasure |
| `CargoRarity` | Common / Rare / Epic |
| `AmmunitionType` | General |
| `CargoIdentificationState` | Unidentified / Identified |

`CargoCategory` 为新主枚举；`CargoType`（Food/Fuel/Ammunition/Treasure）保留为旧版兼容枚举，通过 `CargoCategoryCompatibility`（`ToCategory`/`ToLegacyType`）双向转换。

---

## 命名约定

根据项目规范，ScriptableObject 资产使用**中文文件名**：

- 资产文件名：中文（如 `飞船游戏总配置.asset`）
- `CreateAssetMenu` 菜单路径：中文
- Inspector 分组标题：中文
- C# 类型名和成员名：英文 PascalCase

**禁止**重新生成英文名 SO；重命名时需同步 `.meta` 文件并保持 GUID 不变。

---

## 运行时访问模式

```csharp
// 通过 SpaceshipGameManager 访问总配置
var manager = GetComponent<SpaceshipGameManager>();
var config = manager.Configuration;

// 读取世界规则
var worldRules = config.WorldRules;
float dayDuration = worldRules.DayDurationSeconds;

// 读取蓝图
var playerBlueprint = config.PlayerBlueprint;
foreach (var placement in playerBlueprint.ModulePlacements)
{
    // 实例化模块...
}
```

配置数据在**场景加载时一次性读取**，运行时不再修改 SO 资产。`SpaceshipGameManager` 提供 `TryGetConfiguration` 带有效性校验。

---

## 编辑器支持

- `SpaceshipConfigurationEditors`：中文 SO Inspector 基类（`ChineseScriptableObjectEditor`）
- `ModuleDefinitionEditor`：自定义 Inspector
- 菜单 `Spaceship/飞船/生成配置与模块预制体`（`SpaceshipConfiguredTestAssetBuilder`）批量构建测试资产
- `ShipWorkshopAssetExporter`：保存/更新蓝图 SO 并导出完整飞船 Prefab

---

## 相关文档

- [飞船组装系统](../模块设计/飞船组装系统.md)
- [整体架构设计](../架构设计/整体架构.md)
- [工具与编辑器清单](../工具与编辑器/工具清单.md)
