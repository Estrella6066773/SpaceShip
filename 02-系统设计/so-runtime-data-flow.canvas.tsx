import { Card, CardBody, CardHeader, Text, H1, H2, H3, Stack, useHostTheme } from "cursor/canvas";

// ============================================================
// 按命名空间定义的 SO 类型、持有者、消费者
// ============================================================

interface SONode {
  name: string;
  desc: string;
}

interface HolderNode {
  name: string;
  path: string;
  type: "service" | "component" | "singleton";
}

interface ConsumerNode {
  name: string;
  method: string;
}

interface NamespaceData {
  color: string;
  soTypes: SONode[];
  holders: { node: HolderNode; soRefs: string[] }[];
  consumers: { node: ConsumerNode; readsFrom: string[] }[];
}

const nsData: Record<string, NamespaceData> = {
  Game: {
    color: "#599CE7",
    soTypes: [
      { name: "SpaceshipGameConfiguration", desc: "总配置入口，聚合引用其他 SO" },
      { name: "SpaceshipWorldRules", desc: "地图/碰撞/雷达/残骸物理" },
      { name: "LinkRulesConfig", desc: "链接锚点/贴合/弹簧参数" },
      { name: "ShipResourceConsumptionConfig", desc: "燃料/食物/弹药消耗速率" },
      { name: "PlayerShipSettings", desc: "拆卸/摄像机操控参数" },
      { name: "MinimumSupplyConfig", desc: "最低食物/燃料/弹药阈值" },
    ],
    holders: [
      { node: { name: "SpaceshipGameManager", path: "Core/", type: "singleton" }, soRefs: ["SpaceshipGameConfiguration"] },
      { node: { name: "TemporaryGameDirector", path: "Core/", type: "component" }, soRefs: ["SpaceshipWorldRules", "ShipResourceConsumptionConfig"] },
      { node: { name: "SpaceshipGameFlowController", path: "Core/", type: "component" }, soRefs: ["PlayerShipSettings", "LinkRulesConfig", "ShipResourceConsumptionConfig"] },
      { node: { name: "ShipWorkshopEditingService", path: "Gameplay/Workshop/", type: "service" }, soRefs: ["MinimumSupplyConfig"] },
    ],
    consumers: [
      { node: { name: "ShipAssembly.ConfigurePhysics", method: "ConfigurePhysics()" }, readsFrom: ["SpaceshipWorldRules"] },
      { node: { name: "ShipMotionController", method: "DerelictDrag 常量" }, readsFrom: ["SpaceshipWorldRules"] },
      { node: { name: "ShipCollisionFeedback", method: "Configure()" }, readsFrom: ["SpaceshipWorldRules"] },
      { node: { name: "ShipSensorModules", method: "Configure()" }, readsFrom: ["SpaceshipWorldRules"] },
      { node: { name: "SpaceshipWorldMap", method: "构造函数" }, readsFrom: ["SpaceshipWorldRules"] },
      { node: { name: "SalvageGenerator", method: "GenerateSalvage()" }, readsFrom: ["SpaceshipWorldRules"] },
      { node: { name: "EnemyShipController", method: "Configure()" }, readsFrom: ["SpaceshipWorldRules"] },
      { node: { name: "ShipFuelConsumptionManager", method: "Initialize()" }, readsFrom: ["ShipResourceConsumptionConfig"] },
      { node: { name: "ShipFoodConsumptionManager", method: "Initialize()" }, readsFrom: ["ShipResourceConsumptionConfig"] },
      { node: { name: "ShipAmmunitionConsumptionManager", method: "Initialize()" }, readsFrom: ["ShipResourceConsumptionConfig"] },
      { node: { name: "ShipCameraFollower", method: "Initialize()" }, readsFrom: ["PlayerShipSettings"] },
      { node: { name: "ShipAssemblyInteractionController", method: "ConfigureSettings()" }, readsFrom: ["PlayerShipSettings"] },
      { node: { name: "LinkRules.FromConfig", method: "FromConfig()" }, readsFrom: ["LinkRulesConfig"] },
      { node: { name: "WorkshopStructure", method: "锚点外观/贴合" }, readsFrom: ["LinkRulesConfig"] },
      { node: { name: "ModuleLinkAnchorView", method: "ApplySettings()" }, readsFrom: ["LinkRulesConfig"] },
    ],
  },
  Cargo: {
    color: "#D4A843",
    soTypes: [
      { name: "CargoItemDefinition", desc: "货物类别/稀有度/价格/弹药类型/MaxStack" },
    ],
    holders: [
      { node: { name: "ShipCargoHold", path: "Gameplay/Ships/Cargo/", type: "component" }, soRefs: ["CargoItemDefinition"] },
      { node: { name: "WorkshopCargoSlot", path: "Gameplay/Workshop/", type: "component" }, soRefs: ["CargoItemDefinition"] },
      { node: { name: "WorkshopCargoService", path: "Gameplay/Workshop/", type: "service" }, soRefs: ["CargoItemDefinition"] },
    ],
    consumers: [
      { node: { name: "CargoConsumptionService", method: "ConsumeItem()" }, readsFrom: ["CargoItemDefinition"] },
      { node: { name: "CargoPickup", method: "Create()" }, readsFrom: ["CargoItemDefinition"] },
      { node: { name: "ShopService", method: "GetItemSellUnitPrice()" }, readsFrom: ["CargoItemDefinition"] },
      { node: { name: "WorkshopWarehouse", method: "TryAddItems/TryTakeItems" }, readsFrom: ["CargoItemDefinition"] },
      { node: { name: "ShipRuntimeSnapshot", method: "快照/恢复" }, readsFrom: ["CargoItemDefinition"] },
      { node: { name: "ShipBlueprint", method: "初始货物" }, readsFrom: ["CargoItemDefinition"] },
    ],
  },
  Economy: {
    color: "#6ABF8C",
    soTypes: [
      { name: "ShopDefinition", desc: "商品表/折扣率/刷新间隔" },
      { name: "WarehouseDefinition", desc: "模块格/物品格/堆叠上限" },
    ],
    holders: [
      { node: { name: "ShopSystem", path: "Gameplay/Shop/", type: "service" }, soRefs: ["ShopDefinition"] },
      { node: { name: "ShipWorkshopEditingService", path: "Gameplay/Workshop/", type: "service" }, soRefs: ["WarehouseDefinition"] },
      { node: { name: "SpaceshipGameFlowController", path: "Core/", type: "component" }, soRefs: ["WarehouseDefinition"] },
    ],
    consumers: [
      { node: { name: "ShopService", method: "构造函数" }, readsFrom: ["ShopDefinition"] },
      { node: { name: "WorkshopWarehouse", method: "构造函数" }, readsFrom: ["WarehouseDefinition"] },
    ],
  },
  Workshop: {
    color: "#BF6A9C",
    soTypes: [
      { name: "WorkshopEditorConfig", desc: "拖拽物理/边界尺寸/结构上限/聚合 LinkRules" },
      { name: "ShipWorkshopLibrary", desc: "聚合 Game SO + 已保存飞船列表" },
    ],
    holders: [
      { node: { name: "WorkshopEditorSpace", path: "Gameplay/Workshop/", type: "component" }, soRefs: ["WorkshopEditorConfig"] },
      { node: { name: "ShipWorkshopEditingService", path: "Gameplay/Workshop/", type: "service" }, soRefs: ["ShipWorkshopLibrary"] },
      { node: { name: "ShipWorkshopTestShipSpawner", path: "Gameplay/Workshop/", type: "component" }, soRefs: ["ShipWorkshopLibrary"] },
    ],
    consumers: [
      { node: { name: "WorkshopStructure", method: "CreateRoot/拖拽/边界" }, readsFrom: ["WorkshopEditorConfig"] },
      { node: { name: "WorkshopDepartureResolver", method: "出航物资检查" }, readsFrom: ["WorkshopEditorConfig"] },
      { node: { name: "ShipWorkshopAssetExporter", method: "导出飞船" }, readsFrom: ["ShipWorkshopLibrary"] },
    ],
  },
  Module: {
    color: "#9C6ABF",
    soTypes: [
      { name: "ModuleDefinition", desc: "功能数值/链接面/武器/探测器/护盾" },
    ],
    holders: [
      { node: { name: "ShipModule", path: "Gameplay/Ships/Assembly/", type: "component" }, soRefs: ["ModuleDefinition"] },
      { node: { name: "ShopService", path: "Gameplay/Shop/", type: "service" }, soRefs: ["ModuleDefinition"] },
    ],
    consumers: [
      { node: { name: "ShipAssembly", method: "CoreExplosionDamage" }, readsFrom: ["ModuleDefinition"] },
      { node: { name: "ShipBlueprintRuntimeBuilder", method: "BuildShip()" }, readsFrom: ["ModuleDefinition"] },
      { node: { name: "ShopService", method: "GetModuleSellUnitPrice()" }, readsFrom: ["ModuleDefinition"] },
      { node: { name: "ShipMotionController", method: "速度/推力参数" }, readsFrom: ["ModuleDefinition"] },
      { node: { name: "ShipSensorModules", method: "雷达/灯光" }, readsFrom: ["ModuleDefinition"] },
      { node: { name: "ShipCombatController", method: "武器/护盾" }, readsFrom: ["ModuleDefinition"] },
    ],
  },
  Blueprint: {
    color: "#BF8C6A",
    soTypes: [
      { name: "ShipBlueprint", desc: "模块布局/初始货物/导出 Prefab" },
    ],
    holders: [
      { node: { name: "SpaceshipRestStopController", path: "Core/", type: "component" }, soRefs: ["ShipBlueprint"] },
      { node: { name: "ShipWorkshopEditingService", path: "Gameplay/Workshop/", type: "service" }, soRefs: ["ShipBlueprint"] },
      { node: { name: "WorkshopWarehouse", path: "Gameplay/Workshop/", type: "component" }, soRefs: ["ShipBlueprint"] },
      { node: { name: "WorkshopEditorSpace", path: "Gameplay/Workshop/", type: "component" }, soRefs: ["ShipBlueprint"] },
      { node: { name: "SpaceshipGameConfiguration", path: "Data/Game/", type: "so" }, soRefs: ["ShipBlueprint"] },
    ],
    consumers: [
      { node: { name: "ShipBlueprintRuntimeBuilder", method: "CreateSnapshot/BuildShip" }, readsFrom: ["ShipBlueprint"] },
      { node: { name: "ShipWorkshopAssetExporter", method: "保存/删除/重命名" }, readsFrom: ["ShipBlueprint"] },
      { node: { name: "ShipWorkshopEditingService", method: "RestoreFromSnapshot" }, readsFrom: ["ShipBlueprint"] },
    ],
  },
  Quest: {
    color: "#6ABFBF",
    soTypes: [
      { name: "QuestConfig", desc: "任务阶段/目标/奖励/前置" },
      { name: "QuestGroupConfig", desc: "任务分组标签" },
    ],
    holders: [
      { node: { name: "QuestSystem", path: "Gameplay/Quest/", type: "service" }, soRefs: ["QuestConfig"] },
    ],
    consumers: [
      { node: { name: "QuestService", method: "构造函数/EvaluateActivations" }, readsFrom: ["QuestConfig", "QuestGroupConfig"] },
      { node: { name: "QuestPanel (UI)", method: "TryAccept()" }, readsFrom: ["QuestConfig"] },
      { node: { name: "QuestEventSource", method: "事件载荷" }, readsFrom: ["QuestConfig"] },
      { node: { name: "GameSaveService", method: "QuestSaveEntry.questId" }, readsFrom: ["QuestConfig"] },
    ],
  },
  Presentation: {
    color: "#BF9C6A",
    soTypes: [
      { name: "SpaceshipPresentationConfig", desc: "中文字体等共享表现资源" },
    ],
    holders: [
      { node: { name: "SpaceshipGameConfiguration", path: "Data/Game/", type: "so" }, soRefs: ["SpaceshipPresentationConfig"] },
      { node: { name: "ShipWorkshopLibrary", path: "Data/Workshop/", type: "so" }, soRefs: ["SpaceshipPresentationConfig"] },
      { node: { name: "SpaceshipPresentationInitializer", path: "UI/", type: "component" }, soRefs: ["SpaceshipPresentationConfig"] },
    ],
    consumers: [
      { node: { name: "GameStartMenuController", method: "字体设置" }, readsFrom: ["SpaceshipPresentationConfig"] },
    ],
  },
};

// ============================================================
// 全局数据流信息
// ============================================================
const globalFlows = [
  { from: "SpaceshipGameConfiguration", target: "SpaceshipGameManager", label: "[SerializeField]" },
  { from: "SpaceshipGameConfiguration", target: "TemporaryGameDirector", label: "Configure()" },
  { from: "SpaceshipGameConfiguration", target: "SpaceshipGameFlowController", label: "[SerializeField]" },
  { from: "ShipWorkshopLibrary", target: "ShipWorkshopEditingService", label: "[SerializeField]" },
  { from: "SpaceshipGameConfiguration", target: "ShipBlueprintRuntimeBuilder", label: "BuildShip 参数" },
  { from: "GameSaveService", target: "SaveData", label: "JSON 序列化" },
];

const SAVE_FLOW = "GameSaveService (Core/) 管理 SaveData：金币/欠账/任务状态/模块库存/货物库存/仓库库存/货架库存。\nSpaceshipGameFlowController 在失败时写存档，结算时合并入仓库。ShipRuntimeSnapshot 跨场景传递飞船状态。";

// ============================================================
// Layout constants
// ============================================================
const SVG_WIDTH = 1400;
const PADDING_LEFT = 20;
const PADDING_TOP = 80;

const COL_SO_X = PADDING_LEFT;
const COL_HOLDER_X = 420;
const COL_CONSUMER_X = 820;

const COL_W = 370;

const NODE_H = 20;
const NODE_GAP = 6;
const NAMESPACE_GAP = 24;
const NAMESPACE_HEADER_H = 22;

// ============================================================
// Helper: compute Y positions for each namespace section
// ============================================================
function computeLayout(): { namespaceY: Record<string, number>; nodes: Array<{
  id: string; x: number; y: number; w: number; h: number;
  label: string; sublabel: string; color: string; layer: "so" | "holder" | "consumer";
  ns: string;
}>; nsRects: Array<{ ns: string; x: number; y: number; w: number; h: number; color: string }>;
 totalH: number } {
  const nsList = ["Game", "Economy", "Workshop", "Module", "Cargo", "Blueprint", "Quest", "Presentation"];
  let y = PADDING_TOP;
  const nsY: Record<string, number> = {};
  const nsCols: Record<string, { so: number; holder: number; consumer: number }> = {};
  const allNodes: Array<{ id: string; x: number; y: number; w: number; h: number; label: string; sublabel: string; color: string; layer: "so" | "holder" | "consumer"; ns: string }> = [];
  const nsRects: Array<{ ns: string; x: number; y: number; w: number; h: number; color: string }> = [];

  for (const ns of nsList) {
    const data = nsData[ns];
    if (!data) continue;
    nsY[ns] = y;

    // Header
    y += NAMESPACE_HEADER_H;
    let sectionStartY = y;

    // SO column
    let soY = y;
    for (const so of data.soTypes) {
      allNodes.push({
        id: `${ns}.SO.${so.name}`,
        x: COL_SO_X, y: soY, w: COL_W, h: NODE_H,
        label: so.name, sublabel: so.desc, color: data.color,
        layer: "so", ns,
      });
      soY += NODE_H + NODE_GAP;
    }

    // Holder column
    let holderY = y;
    for (const h of data.holders) {
      allNodes.push({
        id: `${ns}.Holder.${h.node.name}`,
        x: COL_HOLDER_X, y: holderY, w: COL_W, h: NODE_H,
        label: h.node.name, sublabel: h.node.path + (h.node.type === "singleton" ? " (单例)" : h.node.type === "service" ? " (服务)" : " (组件)"), color: data.color,
        layer: "holder", ns,
      });
      holderY += NODE_H + NODE_GAP;
    }

    // Consumer column
    let consumerY = y;
    for (const c of data.consumers) {
      allNodes.push({
        id: `${ns}.Consumer.${c.node.name}`,
        x: COL_CONSUMER_X, y: consumerY, w: COL_W, h: NODE_H,
        label: c.node.name, sublabel: c.node.method, color: data.color,
        layer: "consumer", ns,
      });
      consumerY += NODE_H + NODE_GAP;
    }

    const sectionH = Math.max(soY, holderY, consumerY) - sectionStartY + NODE_GAP;
    nsRects.push({
      ns, x: PADDING_LEFT - 8, y: sectionStartY - 4, w: SVG_WIDTH - PADDING_LEFT * 2 + 16, h: sectionH + 8, color: data.color,
    });
    y = sectionStartY + sectionH + NAMESPACE_GAP;
  }

  return { namespaceY: nsY, nodes: allNodes, nsRects, totalH: y + 20 };
}

const layout = computeLayout();

// ============================================================
// Legend colors
// ============================================================
const NS_COLORS = [
  { ns: "Game", color: "#599CE7", label: "Game — 世界规则/消耗/操控" },
  { ns: "Economy", color: "#6ABF8C", label: "Economy — 商店/仓库" },
  { ns: "Workshop", color: "#BF6A9C", label: "Workshop — 车间编辑/资料库" },
  { ns: "Module", color: "#9C6ABF", label: "Module — 模块定义" },
  { ns: "Cargo", color: "#D4A843", label: "Cargo — 货物定义" },
  { ns: "Blueprint", color: "#BF8C6A", label: "Blueprint — 飞船蓝图" },
  { ns: "Quest", color: "#6ABFBF", label: "Quest — 任务配置" },
  { ns: "Presentation", color: "#BF9C6A", label: "Presentation — 字体/表现" },
];

// ============================================================
// Component
// ============================================================
export default function SORuntimeDataFlowDiagram() {
  const theme = useHostTheme();

  const legendY = 12;
  const legendH = 40;
  const contentStartY = 70;

  // Build arrows
  const arrows: Array<{ x1: number; y1: number; x2: number; y2: number; color: string; midX: number; midY: number; label: string }> = [];

  // For each namespace, link SO -> Holder (based on soRefs)
  for (const ns of Object.keys(nsData)) {
    const data = nsData[ns];
    const color = data.color;
    for (const holder of data.holders) {
      const holderNode = layout.nodes.find(n => n.id === `${ns}.Holder.${holder.node.name}`);
      if (!holderNode) continue;
      for (const soName of holder.soRefs) {
        const soNode = layout.nodes.find(n => n.id === `${ns}.SO.${soName}`);
        if (!soNode) continue;
        const x1 = soNode.x + COL_W;
        const y1 = soNode.y + NODE_H / 2;
        const x2 = holderNode.x;
        const y2 = holderNode.y + NODE_H / 2;
        const midX = (x1 + x2) / 2;
        arrows.push({ x1, y1, x2, y2, color, midX, midY: y1, label: "[SerializeField]" });
      }
    }

    // For each consumer, link from the holder referenced
    for (const consumer of data.consumers) {
      const consumerNode = layout.nodes.find(n => n.id === `${ns}.Consumer.${consumer.node.name}`);
      if (!consumerNode) continue;
      // Find a holder whose soRefs include any of the readsFrom
      const matchingHolders: string[] = [];
      for (const holder of data.holders) {
        for (const soName of holder.soRefs) {
          if (consumer.readsFrom.includes(soName)) {
            const hn = layout.nodes.find(n => n.id === `${ns}.Holder.${holder.node.name}`);
            if (hn) matchingHolders.push(hn.id);
          }
        }
      }
      // Also check direct SO->consumer links for SOs whose data goes directly to consumers
      for (const soName of consumer.readsFrom) {
        const soNode = layout.nodes.find(n => n.id === `${ns}.SO.${soName}`);
        if (soNode) {
          const x1 = soNode.x + COL_W;
          const y1 = soNode.y + NODE_H / 2;
          const x2 = consumerNode.x;
          const y2 = consumerNode.y + NODE_H / 2;
          const midX = (x1 + x2) / 2;
          arrows.push({ x1, y1, x2, y2, color, midX, midY: y1, label: "读取" });
          break;
        }
      }
    }
  }

  // Deduplicate arrows
  const uniqueArrows: typeof arrows = [];
  const seen = new Set<string>();
  for (const a of arrows) {
    const key = `${a.x1.toFixed(0)},${a.y1.toFixed(0)}->${a.x2.toFixed(0)},${a.y2.toFixed(0)}`;
    if (!seen.has(key)) { seen.add(key); uniqueArrows.push(a); }
  }

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", fontSize: 13, background: theme.bg.editor, color: theme.text.primary, padding: 16 }}>
      <H1 style={{ marginBottom: 6 }}>ScriptableObject 配置 → 运行时数据流</H1>
      <Text style={{ color: theme.text.secondary, marginBottom: 4 }}>
        追踪项目中所有 SO 配置文件如何被运行时组件加载、持有和消费，以及存档读写路径。
      </Text>
      <div style={{ display: "flex", marginBottom: 8, fontWeight: 600, fontSize: 11, color: theme.text.primary }}>
        <span style={{ marginLeft: PADDING_LEFT + 8, width: COL_W }}>SO 配置层</span>
        <span style={{ width: COL_W }}>持有层（中间组件/服务）</span>
        <span style={{ width: COL_W }}>消费层（游戏逻辑）</span>
      </div>

      {/* Legend */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: "6px 14px",
        padding: "6px 12px", marginBottom: 10,
        background: theme.fill.secondary, border: `1px solid ${theme.stroke.secondary}`,
        fontSize: 11,
      }}>
        {NS_COLORS.map(c => (
          <div key={c.ns} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 10, height: 10, background: c.color, flexShrink: 0 }} />
            <Text style={{ color: theme.text.secondary }}>{c.ns}</Text>
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 12 }}>
          <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke={theme.text.tertiary} strokeWidth={1} strokeDasharray="4,3" /></svg>
          <Text style={{ color: theme.text.tertiary, fontSize: 10 }}>直接数据流向</Text>
        </div>
      </div>

      {/* Main SVG */}
      <svg width={SVG_WIDTH} height={layout.totalH} style={{ display: "block" }}>
        {/* Namespace background bands */}
        {layout.nsRects.map(r => (
          <rect key={r.ns} x={r.x} y={r.y} width={r.w} height={r.h}
            fill="transparent" stroke={r.color} strokeWidth={1} strokeOpacity={0.25}
            rx={4} ry={4} />
        ))}

        {/* Namespace labels */}
        {layout.nsRects.map(r => (
          <text key={`label-${r.ns}`} x={r.x + 8} y={r.y - 6}
            fill={r.color} fontSize={11} fontWeight={600}
            fontFamily="system-ui">{r.ns}</text>
        ))}

        {/* Arrows */}
        {uniqueArrows.map((a, i) => (
          <g key={`arrow-${i}`}>
            <line x1={a.x1} y1={a.y1} x2={a.x2} y2={a.y2}
              stroke={a.color} strokeWidth={0.8} strokeOpacity={0.4} strokeDasharray="4,3" />
            <polygon points={`${a.x2-5},${a.y2-3} ${a.x2},${a.y2} ${a.x2-5},${a.y2+3}`}
              fill={a.color} fillOpacity={0.4} />
          </g>
        ))}

        {/* Nodes */}
        {layout.nodes.map(node => {
          const isSO = node.layer === "so";
          const isHolder = node.layer === "holder";
          const bgAlpha = isSO ? 0.16 : isHolder ? 0.1 : 0.06;
          return (
            <g key={node.id}>
              <rect x={node.x} y={node.y} width={node.w} height={node.h}
                fill={node.color} fillOpacity={bgAlpha}
                stroke={node.color} strokeWidth={0.8} strokeOpacity={isSO ? 0.6 : 0.3}
                rx={2} ry={2} />
              <text x={node.x + 6} y={node.y + 13.5}
                fill={node.color} fontSize={11} fontWeight={isSO ? 600 : 400}
                fontFamily="system-ui">{node.label}</text>
            </g>
          );
        })}
      </svg>

      {/* Save flow note */}
      <Card style={{ marginTop: 12 }}>
        <CardHeader><H3>存档/恢复路径</H3></CardHeader>
        <CardBody>
          <Text style={{ color: theme.text.secondary, fontSize: 12 }}>{SAVE_FLOW}</Text>
        </CardBody>
      </Card>

      {/* Summary stats */}
      <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 11, color: theme.text.tertiary }}>
        <Text>共有 16 个 ScriptableObject 类型，覆盖 8 个命名空间</Text>
        <Text>通过 12 个中间持有者组件/服务分发</Text>
        <Text>被 40+ 个运行时消费类读取</Text>
        <Text>核心数据通过 GameSaveService 持久化</Text>
      </div>
    </div>
  );
}
