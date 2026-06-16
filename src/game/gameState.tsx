import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import type {
  GameState,
  Unit,
  Mission,
  ResearchNode,
  Position,
  ResourceType,
  UnitType,
} from './types';
import { generateProceduralMap, generateId, EMPTY_RESOURCES } from './mapGenerator';
import { consumeBaseResources, autoRefuelUnits } from './systems/resourceSystem';
import { performBuildStructure } from './systems/constructionSystem';
import { generateRandomMission } from './systems/missionSystem';
import { triggerRandomEvent } from './systems/eventSystem';
import { runCompetitorAITick } from './systems/competitorAI';

interface GameContextType {
  state: GameState;
  pauseGame: () => void;
  resumeGame: () => void;
  selectLocation: (id: string | null) => void;
  selectUnit: (id: string | null) => void;
  assignRouteToUnit: (unitId: string, path: Position[], originId: string | null, destId: string | null) => void;
  loadCargoToUnit: (unitId: string, resource: ResourceType, amount: number) => void;
  unloadCargoFromUnit: (unitId: string, resource: ResourceType, amount: number) => void;
  buildStructure: (locationId: string, type: 'depot' | 'fuel_station' | 'warehouse') => void;
  unlockResearch: (nodeId: string) => void;
  triggerEvent: (type: string) => void;
  acceptMission: (missionId: string) => void;
  buyUnit: (type: UnitType) => void;
  saveGame: () => void;
  loadGame: () => void;
  resetGame: () => void;
  addLogMessage: (message: string, type?: 'info' | 'warning' | 'success' | 'danger') => void;
  logMessages: LogMessage[];
}

export interface LogMessage {
  id: string;
  text: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  timestamp: string;
}

const GameStateContext = createContext<GameContextType | undefined>(undefined);

const INITIAL_RESEARCH: ResearchNode[] = [
  {
    id: 'res_truck_speed',
    name: 'Heavy Duty Axles',
    category: 'transport',
    description: 'Increases Truck Convoy travel speed by 25%.',
    cost: 1000,
    unlocked: false,
    prerequisites: [],
    effects: { truckSpeedMultiplier: 1.25 },
  },
  {
    id: 'res_better_engines',
    name: 'Eco-Diesel Engines',
    category: 'transport',
    description: 'Improves engine thermal efficiency, reducing all unit fuel consumption by 20%.',
    cost: 2000,
    unlocked: false,
    prerequisites: ['res_truck_speed'],
    effects: { engineEfficiencyMultiplier: 0.8 },
  },
  {
    id: 'res_bigger_depots',
    name: 'Automated Cargo Sorting',
    category: 'infrastructure',
    description: 'Increases Depot cargo storage capacity by 50%.',
    cost: 1500,
    unlocked: false,
    prerequisites: [],
    effects: { depotCapacityMultiplier: 1.5 },
  },
  {
    id: 'res_better_roads',
    name: 'Reinforced Asphalt',
    category: 'infrastructure',
    description: 'Reduces road transport costs across rough terrains by 30%.',
    cost: 2500,
    unlocked: false,
    prerequisites: ['res_bigger_depots'],
    effects: { roadCostReductionMultiplier: 0.7 },
  },
  {
    id: 'res_route_opt',
    name: 'Real-time GPS Routing',
    category: 'logistics',
    description: 'Gives dispatch operators optimal routes, reducing distance calculations and maintenance costs by 10%.',
    cost: 3000,
    unlocked: false,
    prerequisites: [],
    effects: { routeOptimizationDiscount: 0.9 },
  },
];

const STARTER_MISSIONS: Mission[] = [
  {
    id: 'mis_1',
    title: 'Fuel Lifeline',
    description: 'Deliver 500 units of Fuel to Forward Base Alpha to power their generators.',
    type: 'deliver',
    status: 'active',
    requirements: {
      targetLocationId: 'loc_2', // Forward Base Alpha
      resourceType: 'fuel',
      amount: 500,
    },
    rewards: {
      money: 5000,
      experience: 250,
    },
  },
  {
    id: 'mis_2',
    title: 'Critical Outpost Supply',
    description: 'Deliver 150 units of Food and Medical Supplies to Outpost Bravo.',
    type: 'deliver',
    status: 'active',
    requirements: {
      targetLocationId: 'loc_3', // Outpost Bravo
      resourceType: 'food',
      amount: 150,
    },
    rewards: {
      money: 4000,
      experience: 200,
    },
  },
  {
    id: 'mis_3',
    title: 'Maintain Supply Lines',
    description: 'Operate the logistics network without any base resource shortages for 5 game days.',
    type: 'maintain_network',
    status: 'active',
    requirements: {
      daysToMaintain: 5,
      daysProgress: 0,
    },
    rewards: {
      money: 10000,
      experience: 500,
    },
  },
];

const UNIT_TEMPLATES = {
  truck: {
    name: 'Truck Convoy',
    capacity: 200,
    fuelConsumption: 1,
    fuelMax: 100,
    speed: 3, // tiles per update
  },
  train: {
    name: 'Cargo Train',
    capacity: 800,
    fuelConsumption: 2,
    fuelMax: 300,
    speed: 5,
  },
  aircraft: {
    name: 'Cargo Aircraft',
    capacity: 300,
    fuelConsumption: 8,
    fuelMax: 500,
    speed: 10,
  },
  ship: {
    name: 'Supply Ship',
    capacity: 1500,
    fuelConsumption: 4,
    fuelMax: 800,
    speed: 2,
  },
};

const createInitialState = (): GameState => {
  const { tiles, locations } = generateProceduralMap();

  const startingUnits: Unit[] = [
    {
      id: 'unit_1',
      name: 'Alpha Convoy (Truck)',
      type: 'truck',
      capacity: 200,
      cargo: { fuel: 50, food: 30, ammunition: 20, medical: 10, spares: 5 },
      fuelConsumption: 1,
      fuelRemaining: 100,
      fuelMax: 100,
      speed: 1, // 1 tile per tick
      status: 'idle',
      currentPosition: { x: 10, y: 45 }, // HQ Base
      path: [],
      pathIndex: 0,
      originId: null,
      destinationId: null,
    },
    {
      id: 'unit_2',
      name: 'Sky Lifter 1 (Air)',
      type: 'aircraft',
      capacity: 300,
      cargo: { fuel: 0, food: 0, ammunition: 0, medical: 0, spares: 0 },
      fuelConsumption: 8,
      fuelRemaining: 500,
      fuelMax: 500,
      speed: 4, // 4 tiles per tick
      status: 'idle',
      currentPosition: { x: 10, y: 45 }, // HQ Base
      path: [],
      pathIndex: 0,
      originId: null,
      destinationId: null,
    },
    {
      id: 'unit_3',
      name: 'Ocean Carrier (Ship)',
      type: 'ship',
      capacity: 1500,
      cargo: { fuel: 200, food: 100, ammunition: 0, medical: 50, spares: 0 },
      fuelConsumption: 4,
      fuelRemaining: 800,
      fuelMax: 800,
      speed: 1,
      status: 'idle',
      currentPosition: { x: 86, y: 30 }, // Sea Port Golf
      path: [],
      pathIndex: 0,
      originId: null,
      destinationId: null,
    },
  ];

  return {
    tiles,
    locations,
    units: startingUnits,
    missions: STARTER_MISSIONS,
    events: [],
    research: INITIAL_RESEARCH,
    economy: {
      budget: 65000,
      income: 0,
      maintenanceCosts: 50,
      fuelCosts: 0,
      constructionCosts: 0,
      profitHistory: [],
    },
    stats: {
      totalDeliveries: 0,
      fuelConsumed: 0,
      routesCreated: 0,
      suppliesDelivered: 0,
      profitEarned: 0,
      efficiencyScore: 100,
    },
    dayCount: 1,
    tickCount: 0,
    paused: true,
    selectedLocationId: null,
    selectedUnitId: null,
    aiOpponent: {
      budget: 50000,
      locations: [],
      units: [],
    },
  };
};

export const GameStateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GameState>(createInitialState);
  const [logMessages, setLogMessages] = useState<LogMessage[]>([]);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const addLogMessage = (text: string, type: 'info' | 'warning' | 'success' | 'danger' = 'info') => {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogMessages((prev) => [
      { id: generateId(), text, type, timestamp },
      ...prev.slice(0, 49), // Keep last 50 logs
    ]);
  };

  // ----------------------------------------------------
  // Action Handlers
  // ----------------------------------------------------

  const pauseGame = () => {
    setState((prev) => ({ ...prev, paused: true }));
    addLogMessage('Operations PAUSED by Command HQ', 'warning');
  };

  const resumeGame = () => {
    setState((prev) => ({ ...prev, paused: false }));
    addLogMessage('Operations RESUMED. Clock is running.', 'info');
  };

  const selectLocation = (id: string | null) => {
    setState((prev) => ({ ...prev, selectedLocationId: id, selectedUnitId: null }));
  };

  const selectUnit = (id: string | null) => {
    setState((prev) => ({ ...prev, selectedUnitId: id, selectedLocationId: null }));
  };

  const assignRouteToUnit = (unitId: string, path: Position[], originId: string | null, destId: string | null) => {
    if (path.length === 0) return;

    setState((prev) => {
      const updatedUnits = prev.units.map((unit) => {
        if (unit.id === unitId) {
          addLogMessage(
            `Unit '${unit.name}' dispatched on new transport mission.`,
            'info'
          );
          return {
            ...unit,
            path,
            pathIndex: 0,
            status: 'moving' as const,
            originId,
            destinationId: destId,
          };
        }
        return unit;
      });

      return {
        ...prev,
        units: updatedUnits,
        stats: {
          ...prev.stats,
          routesCreated: prev.stats.routesCreated + 1,
        },
      };
    });
  };

  const loadCargoToUnit = (unitId: string, resource: ResourceType, amount: number) => {
    setState((prev) => {
      const unit = prev.units.find((u) => u.id === unitId);
      if (!unit || !unit.originId) return prev;

      const location = prev.locations.find((l) => l.id === unit.originId);
      if (!location) return prev;

      // Check limits
      const currentCargoTotal = Object.values(unit.cargo).reduce((a, b) => a + b, 0);
      const availableCapacity = unit.capacity - currentCargoTotal;
      const actualAmount = Math.min(amount, location.resources[resource], availableCapacity);

      if (actualAmount <= 0) return prev;

      const updatedLocations = prev.locations.map((l) => {
        if (l.id === location.id) {
          return {
            ...l,
            resources: {
              ...l.resources,
              [resource]: l.resources[resource] - actualAmount,
            },
          };
        }
        return l;
      });

      const updatedUnits = prev.units.map((u) => {
        if (u.id === unitId) {
          return {
            ...u,
            cargo: {
              ...u.cargo,
              [resource]: u.cargo[resource] + actualAmount,
            },
          };
        }
        return u;
      });

      addLogMessage(`Loaded ${actualAmount} units of ${resource.toUpperCase()} onto ${unit.name} from ${location.name}`, 'info');

      return {
        ...prev,
        locations: updatedLocations,
        units: updatedUnits,
      };
    });
  };

  const unloadCargoFromUnit = (unitId: string, resource: ResourceType, amount: number) => {
    setState((prev) => {
      const unit = prev.units.find((u) => u.id === unitId);
      if (!unit) return prev;

      // Unload at unit current location if it matches a location
      const location = prev.locations.find(
        (l) => l.x === unit.currentPosition.x && l.y === unit.currentPosition.y
      );
      if (!location) return prev;

      const actualAmount = Math.min(amount, unit.cargo[resource]);
      if (actualAmount <= 0) return prev;

      const updatedLocations = prev.locations.map((l) => {
        if (l.id === location.id) {
          // Keep cap
          const spaceLeft = l.maxCapacity - Object.values(l.resources).reduce((a, b) => a + b, 0);
          const loadQty = Math.min(actualAmount, spaceLeft);

          return {
            ...l,
            resources: {
              ...l.resources,
              [resource]: l.resources[resource] + loadQty,
            },
          };
        }
        return l;
      });

      const updatedUnits = prev.units.map((u) => {
        if (u.id === unitId) {
          return {
            ...u,
            cargo: {
              ...u.cargo,
              [resource]: u.cargo[resource] - actualAmount,
            },
          };
        }
        return u;
      });

      addLogMessage(`Unloaded ${actualAmount} units of ${resource.toUpperCase()} from ${unit.name} at ${location.name}`, 'success');

      // Check mission completions
      let updatedMissions = prev.missions;
      if (location.owner === 'player' || location.owner === 'neutral') {
        updatedMissions = prev.missions.map((mis) => {
          if (
            mis.status === 'active' &&
            mis.type === 'deliver' &&
            mis.requirements.targetLocationId === location.id &&
            mis.requirements.resourceType === resource
          ) {
            // Count total delivered (mock check)
            addLogMessage(`Mission objective update: Deliveries made to target base.`, 'success');
            // We'll process full completions in the core tick
          }
          return mis;
        });
      }

      return {
        ...prev,
        locations: updatedLocations,
        units: updatedUnits,
        missions: updatedMissions,
      };
    });
  };

  const buildStructure = (locationId: string, type: 'depot' | 'fuel_station' | 'warehouse') => {
    setState((prev) => {
      const result = performBuildStructure(prev.locations, prev.economy, locationId, type);
      if (result.success) {
        addLogMessage(result.message, 'success');
        return {
          ...prev,
          locations: result.updatedLocations,
          economy: result.updatedEconomy,
        };
      } else {
        addLogMessage(result.message, 'danger');
        return prev;
      }
    });
  };

  const unlockResearch = (nodeId: string) => {
    setState((prev) => {
      const node = prev.research.find((r) => r.id === nodeId);
      if (!node || node.unlocked) return prev;

      if (prev.economy.budget < node.cost) {
        addLogMessage(`RESEARCH FAILED: Lacks research funding of ${node.cost} CR`, 'danger');
        return prev;
      }

      // Check prerequisites
      const prereqsMet = node.prerequisites.every(
        (pid) => prev.research.find((r) => r.id === pid)?.unlocked
      );

      if (!prereqsMet) {
        addLogMessage(`RESEARCH BLOCKED: Missing technological prerequisites!`, 'danger');
        return prev;
      }

      const updatedResearch = prev.research.map((r) => {
        if (r.id === nodeId) {
          return { ...r, unlocked: true };
        }
        return r;
      });

      addLogMessage(`TECH UNLOCKED: ${node.name} successfully deployed.`, 'success');

      return {
        ...prev,
        research: updatedResearch,
        economy: {
          ...prev.economy,
          budget: prev.economy.budget - node.cost,
        },
      };
    });
  };

  const triggerEvent = (type: string) => {
    // Implement in Event phase
    console.log('Event triggered:', type);
  };

  const acceptMission = (missionId: string) => {
    // Implement in Mission phase
    console.log('Mission accepted:', missionId);
  };

  const buyUnit = (type: UnitType) => {
    const costMap = {
      truck: 5000,
      train: 12000,
      aircraft: 25000,
      ship: 18000,
    };

    const cost = costMap[type];

    setState((prev) => {
      if (prev.economy.budget < cost) {
        addLogMessage(`ACQUISITION FAILED: Insufficient command funds to buy ${type.toUpperCase()}`, 'danger');
        return prev;
      }

      // Start unit at player HQ (which is loc_1, check coords)
      const hq = prev.locations.find((l) => l.id === 'loc_1') || prev.locations[0];
      const template = UNIT_TEMPLATES[type];

      const newUnit: Unit = {
        id: `unit_${generateId()}`,
        name: `${template.name} ${prev.units.filter((u) => u.type === type).length + 1}`,
        type,
        capacity: template.capacity,
        cargo: { ...EMPTY_RESOURCES },
        fuelConsumption: template.fuelConsumption,
        fuelRemaining: template.fuelMax,
        fuelMax: template.fuelMax,
        speed: template.speed,
        status: 'idle',
        currentPosition: { x: hq.x, y: hq.y },
        path: [],
        pathIndex: 0,
        originId: null,
        destinationId: null,
      };

      addLogMessage(`ACQUIRED: New logistics asset '${newUnit.name}' commissioned.`, 'success');

      return {
        ...prev,
        units: [...prev.units, newUnit],
        economy: {
          ...prev.economy,
          budget: prev.economy.budget - cost,
        },
      };
    });
  };

  const saveGame = () => {
    try {
      const dataToSave = {
        locations: state.locations,
        units: state.units,
        missions: state.missions,
        research: state.research,
        economy: state.economy,
        stats: state.stats,
        dayCount: state.dayCount,
        tickCount: state.tickCount,
      };
      localStorage.setItem('military_logistics_save', JSON.stringify(dataToSave));
      addLogMessage('Command State auto-saved to local memory bank.', 'success');
    } catch (e) {
      addLogMessage('SAVE FAILURE: Memory buffer write error!', 'danger');
    }
  };

  const loadGame = () => {
    try {
      const savedData = localStorage.getItem('military_logistics_save');
      if (!savedData) {
        addLogMessage('LOAD REPORT: No saved records located in storage.', 'warning');
        return;
      }

      const parsed = JSON.parse(savedData);
      setState((prev) => ({
        ...prev,
        ...parsed,
        paused: true, // starts paused for player safety
      }));
      addLogMessage('TACTICAL RESTORE: Campaign records loaded successfully.', 'success');
    } catch (e) {
      addLogMessage('LOAD EXCEPTION: Corrupt save file detected.', 'danger');
    }
  };

  const resetGame = () => {
    setState(createInitialState());
    setLogMessages([]);
    addLogMessage('TACTICAL RESET: Campaign restarted. Map re-scaffolded.', 'warning');
  };

  // ----------------------------------------------------
  // Game Loop Ticking System (Runs when not paused)
  // ----------------------------------------------------
  useEffect(() => {
    if (state.paused) return;

    const interval = setInterval(() => {
      setState((prev) => {
        let nextTickCount = prev.tickCount + 1;
        let nextDayCount = prev.dayCount;
        let dayEnd = false;

        if (nextTickCount >= 24) {
          nextTickCount = 0;
          nextDayCount += 1;
          dayEnd = true;
        }

        // 0. Update dynamic events
        const updatedEvents = prev.events.map((evt) => ({
          ...evt,
          durationTicks: evt.durationTicks - 1,
        }));

        // Log resolutions of ended events
        updatedEvents.forEach((evt) => {
          if (evt.durationTicks === 0) {
            addLogMessage(`RESOLVED: '${evt.title}' has concluded. Base operations restored.`, 'success');
          }
        });

        const activeEvents = updatedEvents.filter((evt) => evt.durationTicks > 0);
        let finalEvents = [...activeEvents];
        let finalMissions = [...prev.missions];

        if (dayEnd) {
          // Trigger dynamic events (15% chance per day)
          if (Math.random() < 0.15) {
            const newEvent = triggerRandomEvent();
            finalEvents.push(newEvent);
            addLogMessage(`TACTICAL ALERT: ${newEvent.title}. ${newEvent.description}`, 'danger');
          }

          // Generate new missions (30% chance per day, max 5 active)
          const activeCount = prev.missions.filter((m) => m.status === 'active').length;
          if (activeCount < 5 && Math.random() < 0.35) {
            const newMission = generateRandomMission(prev.locations);
            finalMissions.push(newMission);
            addLogMessage(`NEW MISSION DIRECTIVE: ${newMission.title}. Check logs.`, 'info');
          }
        }

        // 1. Resource Consumption at Military Bases
        const { updatedLocations, shortageAlerts } = consumeBaseResources(prev.locations);
        shortageAlerts.forEach((alert) => {
          if (Math.random() < 0.1) addLogMessage(alert, 'danger');
        });

        // 2. Unit movements
        let fuelConsumedTotal = 0;
        const movedUnits = prev.units.map((unit) => {
          if (unit.status === 'moving' && unit.path.length > 0) {
            const nextPathIndex = unit.pathIndex + unit.speed;
            const reachedEnd = nextPathIndex >= unit.path.length - 1;
            const newIndex = reachedEnd ? unit.path.length - 1 : nextPathIndex;
            const newPos = unit.path[newIndex];

            // Calculate fuel consumption
            const stepsTaken = newIndex - unit.pathIndex;
            const fuelDiscount = prev.research.find((r) => r.id === 'res_better_engines')?.unlocked
              ? 0.8
              : 1.0;
            // Apply fuel crisis event modifier if active
            const fuelCrisisMultiplier = finalEvents.some((e) => e.type === 'fuel_crisis') ? 2.0 : 1.0;
            const fuelCost = stepsTaken * unit.fuelConsumption * fuelDiscount * fuelCrisisMultiplier;
            const newFuel = Math.max(0, unit.fuelRemaining - fuelCost);
            fuelConsumedTotal += fuelCost;

            let finalStatus: Unit['status'] = 'moving';
            let currentPath = unit.path;
            let currentPathIndex = newIndex;

            if (newFuel <= 0) {
              finalStatus = 'idle';
              currentPath = [];
              currentPathIndex = 0;
              addLogMessage(`VEHICLE STRANDED: ${unit.name} ran out of fuel in transit!`, 'danger');
            } else if (reachedEnd) {
              finalStatus = 'idle';
              currentPath = [];
              currentPathIndex = 0;
              addLogMessage(`ARRIVAL REPORT: ${unit.name} reached destination successfully.`, 'success');
            }

            return {
              ...unit,
              currentPosition: newPos,
              path: currentPath,
              pathIndex: currentPathIndex,
              fuelRemaining: parseFloat(newFuel.toFixed(1)),
              status: finalStatus,
            };
          }
          return unit;
        });

        // 2b. Auto-refuel idle units
        const { updatedUnits, updatedLocations: refueledLocations, refuelLogs } = autoRefuelUnits(
          movedUnits,
          updatedLocations
        );
        refuelLogs.forEach((log) => addLogMessage(log, 'success'));

        // 2c. Run AI competitor logic
        const {
          updatedLocations: aiLocations,
          updatedMissions: aiMissions,
          updatedAIBudget,
          aiMessages,
        } = runCompetitorAITick(
          {
            ...prev,
            locations: refueledLocations,
            missions: finalMissions,
            events: finalEvents,
            tickCount: nextTickCount,
            dayCount: nextDayCount,
          },
          prev.aiOpponent.budget
        );
        aiMessages.forEach((msg) => addLogMessage(msg, 'warning'));

        // 3. Economy updates (Daily balance)
        let updatedBudget = prev.economy.budget;
        let dayMaintenance = prev.economy.maintenanceCosts;

        if (dayEnd) {
          // Maintenance subtraction
          updatedBudget = Math.max(0, updatedBudget - dayMaintenance);
          addLogMessage(`HQ FINANCE: Deducted daily operational maintenance: -${dayMaintenance} CR`, 'warning');
        }

        // 4. Mission checks and triggers
        const checkedMissions = aiMissions.map((mis) => {
          if (mis.status !== 'active') return mis;

          if (mis.type === 'deliver' && mis.requirements.targetLocationId) {
            const targetLoc = aiLocations.find((l) => l.id === mis.requirements.targetLocationId);
            const reqRes = mis.requirements.resourceType;
            const reqAmt = mis.requirements.amount || 0;

            if (targetLoc && reqRes && targetLoc.resources[reqRes] >= reqAmt) {
              addLogMessage(`MISSION COMPLETE: '${mis.title}' achieved. +${mis.rewards.money} CR`, 'success');
              updatedBudget += mis.rewards.money;
              return { ...mis, status: 'completed' as const };
            }
          }

          if (mis.type === 'maintain_network' && dayEnd) {
            const progress = (mis.requirements.daysProgress || 0) + 1;
            if (progress >= (mis.requirements.daysToMaintain || 5)) {
              addLogMessage(`MISSION COMPLETE: '${mis.title}' achieved. +${mis.rewards.money} CR`, 'success');
              updatedBudget += mis.rewards.money;
              return { ...mis, status: 'completed' as const, requirements: { ...mis.requirements, daysProgress: progress } };
            }
            return {
              ...mis,
              requirements: { ...mis.requirements, daysProgress: progress },
            };
          }

          return mis;
        });

        // 5. Update overall stats
        const nextStats = {
          ...prev.stats,
          fuelConsumed: parseFloat((prev.stats.fuelConsumed + fuelConsumedTotal).toFixed(1)),
          profitEarned: prev.stats.profitEarned + (dayEnd ? -dayMaintenance : 0),
        };

        return {
          ...prev,
          locations: aiLocations,
          units: updatedUnits,
          missions: checkedMissions,
          events: finalEvents,
          economy: {
            ...prev.economy,
            budget: updatedBudget,
            income: dayEnd ? -dayMaintenance : prev.economy.income,
          },
          stats: nextStats,
          dayCount: nextDayCount,
          tickCount: nextTickCount,
          aiOpponent: {
            budget: updatedAIBudget,
            locations: [],
            units: [],
          },
        };
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [state.paused]);

  // Initial welcome message
  useEffect(() => {
    addLogMessage('Welcome Commander. Tactical operations center activated.', 'info');
    addLogMessage('Deploy trucks or planes from HQ Base to transport supplies.', 'info');
  }, []);

  return (
    <GameStateContext.Provider
      value={{
        state,
        pauseGame,
        resumeGame,
        selectLocation,
        selectUnit,
        assignRouteToUnit,
        loadCargoToUnit,
        unloadCargoFromUnit,
        buildStructure,
        unlockResearch,
        triggerEvent,
        acceptMission,
        buyUnit,
        saveGame,
        loadGame,
        resetGame,
        addLogMessage,
        logMessages,
      }}
    >
      {children}
    </GameStateContext.Provider>
  );
};

export const useGameState = () => {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
};
