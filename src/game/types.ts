export type Position = {
  x: number;
  y: number;
};

export type TerrainType = 'plain' | 'mountain' | 'river' | 'road' | 'rail' | 'sea';

export interface MapTile {
  x: number;
  y: number;
  terrainType: TerrainType;
}

export type LocationType = 'city' | 'military_base' | 'depot' | 'fuel_station' | 'warehouse' | 'port';

export interface ResourceInventory {
  fuel: number;
  food: number;
  ammunition: number;
  medical: number;
  spares: number;
}

export type ResourceType = keyof ResourceInventory;

export interface MapLocation {
  id: string;
  name: string;
  type: LocationType;
  x: number;
  y: number;
  resources: ResourceInventory;
  maxCapacity: number;
  owner: 'player' | 'ai' | 'neutral';
  connectedTo: string[]; // IDs of other locations connected in the supply network
  // Base consumption rate per tick (only for military bases)
  consumptionRate?: Partial<ResourceInventory>;
}

export type UnitType = 'truck' | 'train' | 'aircraft' | 'ship';

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  capacity: number;
  cargo: ResourceInventory;
  fuelConsumption: number; // fuel consumed per step
  fuelRemaining: number;
  fuelMax: number;
  speed: number; // speed in milliseconds per step or cell-ticks per update
  status: 'idle' | 'moving' | 'unloading' | 'refueling';
  currentPosition: Position;
  path: Position[];
  pathIndex: number;
  originId: string | null;
  destinationId: string | null;
  // Route estimation fields
  routeStats?: {
    distance: number;
    fuelCost: number;
    travelTime: number;
  };
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  type: 'deliver' | 'supply_bases' | 'maintain_network' | 'emergency';
  status: 'active' | 'completed' | 'failed';
  requirements: {
    targetLocationId?: string;
    targetLocationIds?: string[]; // Multiple bases for supply_bases
    resourceType?: ResourceType;
    amount?: number;
    daysToMaintain?: number; // For maintain_network
    daysProgress?: number;
  };
  rewards: {
    money: number;
    experience: number;
  };
}

export type GameEventType =
  | 'fuel_crisis'
  | 'flood'
  | 'storm'
  | 'equipment_failure'
  | 'theft'
  | 'bridge_collapse';

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  type: GameEventType;
  durationTicks: number;
  affectedLocationIds?: string[];
  affectedTileCoords?: Position[];
}

export interface ResearchNode {
  id: string;
  name: string;
  category: 'transport' | 'infrastructure' | 'logistics';
  description: string;
  cost: number;
  unlocked: boolean;
  prerequisites: string[];
  effects: {
    truckSpeedMultiplier?: number;
    engineEfficiencyMultiplier?: number; // multiplier < 1.0 reduces fuel consumption
    depotCapacityMultiplier?: number;
    roadCostReductionMultiplier?: number;
    routeOptimizationDiscount?: number;
  };
}

export interface EconomyState {
  budget: number;
  income: number;
  maintenanceCosts: number;
  fuelCosts: number;
  constructionCosts: number;
  profitHistory: { tick: number; profit: number }[];
}

export interface GameStats {
  totalDeliveries: number;
  fuelConsumed: number;
  routesCreated: number;
  suppliesDelivered: number;
  profitEarned: number;
  efficiencyScore: number;
}

export interface GameState {
  tiles: MapTile[][]; // Grid representation (e.g. 100x100)
  locations: MapLocation[];
  units: Unit[];
  missions: Mission[];
  events: GameEvent[];
  research: ResearchNode[];
  economy: EconomyState;
  stats: GameStats;
  dayCount: number;
  tickCount: number;
  paused: boolean;
  selectedLocationId: string | null;
  selectedUnitId: string | null;
  aiOpponent: {
    budget: number;
    locations: MapLocation[];
    units: Unit[];
  };
}
