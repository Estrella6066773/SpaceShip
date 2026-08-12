# ScriptableObject 配置 → 运行时数据流

> 16 个 SO 类型 · 8 个命名空间 · 12 个中间持有者 · 40+ 个消费类
> 数据流分两大场景：探索（Expedition）与休整站/车间（RestStop）

---

## 一、总览

```mermaid
flowchart TB
    subgraph S1["① 探索场景 Expedition"]
        direction TB
        GC["SpaceshipGameConfiguration<br/>总配置（聚合 Game 全部 SO）"]
        GM["SpaceshipGameManager（单例）"]
        TD["TemporaryGameDirector"]
        FC["SpaceshipGameFlowController"]
    end

    subgraph S2["② 休整站/车间 RestStop"]
        direction TB
        WL["ShipWorkshopLibrary<br/>（聚合 Game SO 副本 + 已保存飞船）"]
        WE["ShipWorkshopEditingService"]
        WS["WorkshopEditorSpace"]
        SS["ShopSystem"]
        QS["QuestSystem"]
    end

    subgraph S3["③ 存档持久化"]
        SV["GameSaveService"]
        SN["ShipRuntimeSnapshot"]
    end

    GC --> GM
    GC --> TD
    GC --> FC
    WL --> WE
    FC --> SV
    SV --> SN

    classDef so fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    classDef hold fill:#fef3c7,stroke:#d97706,color:#78350f;
    classDef save fill:#d1fae5,stroke:#059669,color:#064e3b;
    class GC,WL so;
    class GM,TD,FC,WE,WS,SS,QS hold;
    class SV,SN save;
```

---

## 二、探索场景：SO → 消费类

```mermaid
flowchart TB
    subgraph GW["Game 命名空间 SO"]
        WRL["SpaceshipWorldRules"]
        RES["ShipResourceConsumptionConfig"]
        SET["PlayerShipSettings"]
        LNK["LinkRulesConfig"]
    end

    subgraph C1["世界物理 / 地图"]
        A1["ShipAssembly.ConfigurePhysics"]
        A2["ShipMotionController"]
        A3["ShipCollisionFeedback"]
        A4["ShipSensorModules"]
        A5["SpaceshipWorldMap"]
        A6["SalvageGenerator"]
        A7["EnemyShipController"]
    end

    subgraph C2["消耗管理"]
        B1["ShipFuelConsumptionManager"]
        B2["ShipFoodConsumptionManager"]
        B3["ShipAmmunitionConsumptionManager"]
    end

    subgraph C3["操控 / 摄像机"]
        D1["ShipCameraFollower"]
        D2["ShipAssemblyInteractionController"]
    end

    subgraph C4["链接规则"]
        E1["LinkRules.FromConfig"]
        E2["WorkshopStructure"]
        E3["ModuleLinkAnchorView"]
    end

    WRL --> A1 & A2 & A3 & A4 & A5 & A6 & A7
    RES --> B1 & B2 & B3
    SET --> D1 & D2
    LNK --> E1 & E2 & E3

    classDef so fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    classDef con fill:#f3e8ff,stroke:#9333ea,color:#4c1d95;
    class WRL,RES,SET,LNK so;
    class A1,A2,A3,A4,A5,A6,A7,B1,B2,B3,D1,D2,E1,E2,E3 con;
```

---

## 三、休整站/车间场景

```mermaid
flowchart TB
    subgraph ESO["Economy SO"]
        SHOP["ShopDefinition"]
        WH["WarehouseDefinition"]
    end

    subgraph HOLD["持有者"]
        SH["ShopSystem"]
        ED["ShipWorkshopEditingService"]
        ES["WorkshopEditorSpace"]
        QSYS["QuestSystem"]
    end

    subgraph CON["消费类"]
        SSV["ShopService"]
        WW["WorkshopWarehouse"]
        WST["WorkshopStructure"]
        WDR["WorkshopDepartureResolver"]
        QSV["QuestService"]
        QP["QuestPanel"]
    end

    SHOP --> SH --> SSV
    WH --> ED --> WW
    ED --> WST
    WDR --> ES
    QSYS --> QSV --> QP

    classDef so fill:#d1fae5,stroke:#059669,color:#064e3b;
    classDef hold fill:#fef3c7,stroke:#d97706,color:#78350f;
    classDef con fill:#f3e8ff,stroke:#9333ea,color:#4c1d95;
    class SHOP,WH so;
    class SH,ED,ES,QSYS hold;
    class SSV,WW,WST,WDR,QSV,QP con;
```

---

## 四、货物 / 模块 / 蓝图

```mermaid
flowchart TB
    subgraph SO["SO"]
        CGO["CargoItemDefinition"]
        MOD["ModuleDefinition"]
        BP["ShipBlueprint"]
    end

    subgraph HOLD["持有者"]
        CH["ShipCargoHold"]
        SM["ShipModule"]
        RC["SpaceshipRestStopController"]
    end

    subgraph CON["消费类"]
        CCS["CargoConsumptionService"]
        CP["CargoPickup"]
        SSV["ShopService"]
        BRB["ShipBlueprintRuntimeBuilder"]
        SCC["ShipCombatController"]
        SMC["ShipMotionController"]
        AEX["ShipWorkshopAssetExporter"]
        RSN["ShipRuntimeSnapshot"]
    end

    CGO --> CH --> CCS
    CGO --> CP
    CGO --> SSV
    CGO --> RSN
    MOD --> SM --> SCC
    MOD --> SMC
    MOD --> SSV
    BP --> RC --> BRB
    BP --> AEX
    BP --> BRB

    classDef so fill:#ffedd5,stroke:#ea580c,color:#7c2d12;
    classDef hold fill:#fef3c7,stroke:#d97706,color:#78350f;
    classDef con fill:#f3e8ff,stroke:#9333ea,color:#4c1d95;
    class CGO,MOD,BP so;
    class CH,SM,RC hold;
    class CCS,CP,SSV,BRB,SCC,SMC,AEX,RSN con;
```

---

## 五、任务 / 表现

```mermaid
flowchart TB
    QCFG["QuestConfig"]
    QGRP["QuestGroupConfig"]
    PCFG["SpaceshipPresentationConfig"]

    QSYS["QuestSystem"]
    PINT["SpaceshipPresentationInitializer"]

    QSV["QuestService"]
    QP["QuestPanel"]
    QEV["QuestEventSource"]
    GSV["GameSaveService"]
    MENU["GameStartMenuController"]

    QCFG --> QSYS --> QSV
    QGRP --> QSV
    QSV --> QP
    QSV --> QEV
    QCFG --> GSV
    PCFG --> PINT --> MENU

    classDef so fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    classDef hold fill:#fef3c7,stroke:#d97706,color:#78350f;
    classDef con fill:#f3e8ff,stroke:#9333ea,color:#4c1d95;
    class QCFG,QGRP,PCFG so;
    class QSYS,PINT hold;
    class QSV,QP,QEV,GSV,MENU con;
```

---

## 跨命名空间引用

```mermaid
flowchart LR
    GC["SpaceshipGameConfiguration"]
    WL["ShipWorkshopLibrary"]
    SHOP["ShopDefinition"]
    BP["ShipBlueprint"]
    CGO["CargoItemDefinition"]
    MOD["ModuleDefinition"]
    LNK["LinkRulesConfig"]
    WEC["WorkshopEditorConfig"]

    GC --> BP
    SHOP --> CGO
    SHOP --> MOD
    BP --> CGO
    BP --> MOD
    WL --> BP
    WEC --> LNK

    classDef so fill:#fce7f3,stroke:#db2777,color:#831843;
    class GC,WL,SHOP,BP,CGO,MOD,LNK,WEC so;
```

---

## 存档 / 恢复路径

```mermaid
flowchart TB
    subgraph SAVE["SaveData（GameSaveService 管理）"]
        GOLD["金币 / 欠账"]
        QUEST["任务状态 QuestSaveEntry"]
        MODINV["模块库存"]
        CGOINV["货物库存"]
        WHINV["仓库 / 货架库存"]
    end

    FC["SpaceshipGameFlowController<br/>失败时 / 结算时"]
    SNAP["ShipRuntimeSnapshot<br/>跨场景传递飞船状态"]

    FC --> SAVE
    SAVE --> SNAP

    classDef s fill:#d1fae5,stroke:#059669,color:#064e3b;
    class GOLD,QUEST,MODINV,CGOINV,WHINV s;
```

---

## 统计

| 指标 | 数值 |
|---|---|
| ScriptableObject 类型 | 16 个 |
| 命名空间 | 8 个 |
| 中间持有者（组件 / 服务 / 单例） | 12 个 |
| 运行时消费类 | 40+ 个 |
