import type { MapLocation, Mission, GameState } from '../types';

interface AIAction {
  updatedLocations: MapLocation[];
  updatedMissions: Mission[];
  updatedAIBudget: number;
  aiMessages: string[];
}

/**
 * Executes a strategic decision tick for the logistics competitor AI
 */
export function runCompetitorAITick(
  state: GameState,
  currentAIBudget: number
): AIAction {
  const aiMessages: string[] = [];
  let updatedLocations = [...state.locations];
  let updatedMissions = [...state.missions];
  let updatedBudget = currentAIBudget;

  // AI executes a move approximately once every 4 game days (once every 96 ticks)
  // Let's decide based on a probability or checking ticks
  const isAITurn = state.tickCount === 12 && state.dayCount % 3 === 0;

  if (isAITurn) {
    const actionRoll = Math.random();

    if (actionRoll < 0.4) {
      // 1. AI expands network to a neutral city/port
      const neutralLocations = updatedLocations.filter(
        (l) => l.owner === 'neutral' && l.type !== 'military_base'
      );

      if (neutralLocations.length > 0 && updatedBudget >= 8000) {
        const target = neutralLocations[Math.floor(Math.random() * neutralLocations.length)];
        updatedBudget -= 8000;

        updatedLocations = updatedLocations.map((loc) => {
          if (loc.id === target.id) {
            return {
              ...loc,
              owner: 'ai' as const,
              type: 'depot' as const, // Upgrades it to a depot
            };
          }
          return loc;
        });

        aiMessages.push(
          `COMPETITOR EXPANSION: Global Logistics Corp has acquired ${target.name} and established a regional depot!`
        );
      }
    } else if (actionRoll < 0.8) {
      // 2. AI completes/steals a contract from the mission queue
      const activeDeliveries = updatedMissions.filter(
        (m) => m.status === 'active' && m.type === 'deliver'
      );

      if (activeDeliveries.length > 0) {
        // AI steals the first active delivery
        const stolenIdx = Math.floor(Math.random() * activeDeliveries.length);
        const stolenMission = activeDeliveries[stolenIdx];

        updatedMissions = updatedMissions.map((m) => {
          if (m.id === stolenMission.id) {
            return {
              ...m,
              status: 'failed' as const, // Fails/removes it for player
            };
          }
          return m;
        });

        const reward = stolenMission.rewards.money;
        updatedBudget += reward;

        aiMessages.push(
          `COMPETITOR CONTRACTS: Rival GLC completed '${stolenMission.title}' at ${
            state.locations.find((l) => l.id === stolenMission.requirements.targetLocationId)?.name || 'target base'
          } ahead of our convoys!`
        );
      }
    } else {
      // 3. AI funds research upgrades
      updatedBudget += 5000; // AI generated passive income
      aiMessages.push(`COMPETITOR INTELLIGENCE: Rival GLC has invested in new engine efficiency technologies.`);
    }
  }

  return {
    updatedLocations,
    updatedMissions,
    updatedAIBudget: updatedBudget,
    aiMessages,
  };
}
