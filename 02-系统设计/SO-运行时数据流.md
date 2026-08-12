# ScriptableObject 配置 → 运行时数据流

> 16 个 SO 类型 · 8 个命名空间 · 12 个中间持有者 · 40+ 个消费类

---

## 数据流总览

```mermaid
flowchart LR

  subgraph SO["📦 SO 配置层"]
    subgraph G_SO["Game"]
      G1["SpaceshipGameConfiguration 总配置入口"]
      G2["SpaceshipWorldRules 地图碰撞雷达"]
      G3["LinkRulesConfig 链接锚点弹簧"]
      G4["ShipResourceConsumptionConfig 燃料食物弹药速率"]
      G5["PlayerShipSettings 操控摄像机参数"]
      G6["MinimumSupplyConfig 最低物资阈值"]
    end
    subgraph C_SO["Cargo"]
      C1["CargoItemDefinition 货物类别价格堆叠"]
    end
    subgraph E_SO["Economy"]
      E1["ShopDefinition 商品表折扣刷新"]
      E2["WarehouseDefinition 仓库容量堆叠规则"]
    end
    subgraph W_SO["Workshop"]
      W1["WorkshopEditorConfig 拖拽边界结构上限"]
      W2["ShipWorkshopLibrary 聚合GameSO+飞船列表"]
    end
    subgraph M_SO["Module"]
      M1["ModuleDefinition 速度武器护盾雷达"]
    end
    subgraph B_SO["Blueprint"]
      B1["ShipBlueprint 模块布局初始货物"]
    end
    subgraph Q_SO["Quest"]
      Q1["QuestConfig 阶段目标奖励前置"]
      Q2["QuestGroupConfig 任务分组标签"]
    end
    subgraph P_SO["Presentation"]
      P1["SpaceshipPresentationConfig 中文字体"]
    end
  end

  subgraph HOLD["🔗 持有层 运行时间组件"]
    H1["SpaceshipGameManager 单例Core"]
    H2["TemporaryGameDirector 组件Core"]
    H3["SpaceshipGameFlowController 组件Core"]
    H4["ShipWorkshopEditingService 服务Workshop"]
    H5["ShipCargoHold 组件Ships"]
    H6["WorkshopCargoSlot 组件Workshop"]
    H7["WorkshopCargoService 服务Workshop"]
    H8["ShopSystem 服务Shop"]
    H9["WorkshopEditorSpace 组件Workshop"]
    H10["ShipModule 组件ShipsAssembly"]
    H11["ShipWorkshopTestShipSpawner 组件Workshop"]
    H12["SpaceshipRestStopController 组件Core"]
    H13["QuestSystem 服务Quest"]
    H14["SpaceshipPresentationInitializer 组件UI"]
  end

  subgraph CONS["⚙️ 消费层 游戏逻辑"]
    CN1["ShipAssembly.ConfigurePhysics()"]
    CN2["ShipMotionController 推力阻尼"]
    CN3["ShipCollisionFeedback"]
    CN4["ShipSensorModules 雷达探测"]
    CN5["SpaceshipWorldMap 地图生成"]
    CN6["SalvageGenerator 残骸生成"]
    CN7["EnemyShipController"]
    CN8["ShipFuelConsumptionManager"]
    CN9["ShipFoodConsumptionManager"]
    CN10["ShipAmmunitionConsumptionManager"]
    CN11["ShipCameraFollower"]
    CN12["ShipAssemblyInteractionController"]
    CN13["LinkRules.FromConfig()"]
    CN14["WorkshopStructure 拖拽边界"]
    CN15["ModuleLinkAnchorView"]
    CN16["ShipBlueprintRuntimeBuilder BuildShip()"]
    CN17["ShipCombatController 武器护盾"]
    CN18["ShipWorkshopAssetExporter 保存删除"]
    CN19["ShipRuntimeSnapshot 快照恢复"]
    CN20["ShopService 买卖定价"]
    CN21["WorkshopWarehouse 存取货物"]
    CN22["CargoConsumptionService"]
    CN23["CargoPickup"]
    CN24["WorkshopDepartureResolver 出航检查"]
    CN25["QuestService 激活接取完成"]
    CN26["QuestPanel UI"]
    CN27["QuestEventSource"]
    CN28["GameSaveService 存档读档"]
    CN29["GameStartMenuController 字体设置"]
  end

  G1 -.-> H1
  G1 -.-> H2
  G1 -.-> H3
  G2 -.-> H2
  G3 -.-> H3
  G4 -.-> H2
  G4 -.-> H3
  G5 -.-> H3
  G6 -.-> H4
  G2 -.-> CN1
  G2 -.-> CN2
  G2 -.-> CN3
  G2 -.-> CN4
  G2 -.-> CN5
  G2 -.-> CN6
  G2 -.-> CN7
  G4 -.-> CN8
  G4 -.-> CN9
  G4 -.-> CN10
  G5 -.-> CN11
  G5 -.-> CN12
  G3 -.-> CN13
  G3 -.-> CN14
  G3 -.-> CN15
  C1 -.-> H5
  C1 -.-> H6
  C1 -.-> H7
  C1 -.-> CN22
  C1 -.-> CN23
  C1 -.-> CN20
  C1 -.-> CN21
  C1 -.-> CN19
  E1 -.-> H8
  E2 -.-> H4
  E2 -.-> H3
  E1 -.-> CN20
  E2 -.-> CN21
  W1 -.-> H9
  W2 -.-> H4
  W2 -.-> H11
  W1 -.-> CN14
  W1 -.-> CN24
  W2 -.-> CN18
  M1 -.-> H10
  M1 -.-> H8
  M1 -.-> CN1
  M1 -.-> CN16
  M1 -.-> CN20
  M1 -.-> CN2
  M1 -.-> CN4
  M1 -.-> CN17
  B1 -.-> H12
  B1 -.-> H4
  B1 -.-> H9
  B1 -.-> CN16
  B1 -.-> CN18
  Q1 -.-> H13
  Q1 -.-> CN25
  Q2 -.-> CN25
  Q1 -.-> CN26
  Q1 -.-> CN27
  Q1 -.-> CN28
  P1 -.-> H14
  P1 -.-> W2
  P1 -.-> CN29
  G1 -.-> B1
  E1 -.-> C1
  E1 -.-> M1
  B1 -.-> C1
  B1 -.-> M1
  W2 -.-> G2
  W2 -.-> G3
  W2 -.-> G4
  W2 -.-> G5
  W2 -.-> P1
  H3 -.-> CN28
  CN28 -.-> CN19
```

---

## 两大场景分叉

### 探索场景（Expedition）

```
SpaceshipGameConfiguration
  ├─→ SpaceshipGameManager（单例，持有总配置）
  ├─→ TemporaryGameDirector
  │     ├─ WorldRules → ShipAssembly / ShipMotionController / ShipCollisionFeedback
  │     │               / ShipSensorModules / SpaceshipWorldMap / SalvageGenerator / EnemyShipController
  │     └─ ResourceConfig → 三个消耗管理器（燃料 / 食物 / 弹药）
  └─→ SpaceshipGameFlowController
        ├─ PlayerShipSettings → ShipCameraFollower / ShipAssemblyInteractionController
        └─ LinkRulesConfig → LinkRules.FromConfig() → 链接交互控制器 + 锚点视图
```

### 休整站 / 车间场景（RestStop）

```
ShipWorkshopLibrary（聚合 Game SO 副本 + 已保存飞船）
  └─→ ShipWorkshopEditingService
        ├─ WarehouseDefinition → WorkshopWarehouse
        ├─ MinimumSupplyConfig → 借贷补全
        └─ ShipBlueprint → WorkshopEditorSpace / 导出 / 快照恢复

WorkshopEditorConfig → WorkshopEditorSpace
  └─→ WorkshopStructure（拖拽物理 / 边界）
  └─→ WorkshopDepartureResolver（出航物资检查）

ShopSystem → ShopDefinition → ShopService（买卖定价）

QuestSystem → QuestConfig → QuestService → QuestPanel / QuestEventSource
```

---

## 存档路径

```
GameSaveService（Core/）管理 SaveData
  ├─ 金币 / 欠账
  ├─ 任务状态（QuestSaveEntry.questId）
  ├─ 模块库存
  ├─ 货物库存
  └─ 仓库库存 / 货架库存

写入时机：SpaceshipGameFlowController → 失败时 / 结算时合并入仓库
跨场景传递：ShipRuntimeSnapshot → 飞船状态（货物快照）
```

---

## 跨命名空间引用

| 引用路径 | 说明 |
|---|---|
| `SpaceshipGameConfiguration` → `ShipBlueprint` | 玩家基础飞船蓝图 |
| `ShopDefinition` → `CargoItemDefinition`、`ModuleDefinition` | 商品条目指向货物/模块定义 |
| `ShipBlueprint` → `CargoItemDefinition`、`ModuleDefinition` | 蓝图内初始货物和模块布局 |
| `ShipWorkshopLibrary` → Game 全部 SO + `ShipBlueprint` 列表 | 车间资料库聚合 |
| `WorkshopEditorConfig` → `LinkRulesConfig` | 车间版链接规则独立副本 |

---

## 统计

| 指标 | 数值 |
|---|---|
| ScriptableObject 类型 | 16 个 |
| 命名空间 | 8 个 |
| 中间持有者（组件 / 服务 / 单例） | 12 个 |
| 运行时消费类 | 40+ 个 |
