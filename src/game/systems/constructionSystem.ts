import type { MapLocation, EconomyState } from '../types';

export interface ConstructionResult {
  updatedLocations: MapLocation[];
  updatedEconomy: EconomyState;
  success: boolean;
  message: string;
}

const STRUCTURE_COSTS = {
  depot: 8000,
  fuel_station: 5000,
  warehouse: 15000,
};

const STRUCTURE_CAPACITIES = {
  depot: 2000,
  fuel_station: 1500,
  warehouse: 5000,
};

/**
 * Builds a logistics structure at a specific location
 */
export function performBuildStructure(
  locations: MapLocation[],
  economy: EconomyState,
  locationId: string,
  structureType: 'depot' | 'fuel_station' | 'warehouse'
): ConstructionResult {
  const cost = STRUCTURE_COSTS[structureType];

  // Budget check
  if (economy.budget < cost) {
    return {
      updatedLocations: locations,
      updatedEconomy: economy,
      success: false,
      message: `CONSTRUCTION DENIED: Insufficient command funds. Requires ${cost} CR.`,
    };
  }

  const targetLoc = locations.find((l) => l.id === locationId);
  if (!targetLoc) {
    return {
      updatedLocations: locations,
      updatedEconomy: economy,
      success: false,
      message: 'CONSTRUCTION ERROR: Target sector coordinates invalid.',
    };
  }

  // Deduct cost and update construction costs stats
  const updatedEconomy: EconomyState = {
    ...economy,
    budget: economy.budget - cost,
    constructionCosts: economy.constructionCosts + cost,
  };

  // Find other player locations to interconnect the supply chain
  const playerLocations = locations.filter(
    (l) => l.id !== locationId && (l.owner === 'player' || l.connectedTo.length > 0)
  );

  let nearestLocationId: string | null = null;
  let minDistance = Infinity;

  playerLocations.forEach((loc) => {
    const dist = Math.hypot(loc.x - targetLoc.x, loc.y - targetLoc.y);
    if (dist < minDistance) {
      minDistance = dist;
      nearestLocationId = loc.id;
    }
  });

  const updatedLocations = locations.map((loc) => {
    if (loc.id === locationId) {
      const connections = [...loc.connectedTo];
      if (nearestLocationId && !connections.includes(nearestLocationId)) {
        connections.push(nearestLocationId);
      }

      return {
        ...loc,
        type: structureType,
        maxCapacity: STRUCTURE_CAPACITIES[structureType],
        owner: 'player' as const,
        connectedTo: connections,
      };
    }

    // Connect the nearest base back to this new base to make it bi-directional
    if (nearestLocationId && loc.id === nearestLocationId) {
      const connections = [...loc.connectedTo];
      if (!connections.includes(locationId)) {
        connections.push(locationId);
      }
      return {
        ...loc,
        connectedTo: connections,
      };
    }

    return loc;
  });

  const connMsg = nearestLocationId
    ? `Linked to ${locations.find((l) => l.id === nearestLocationId)?.name || 'nearest depot'}.`
    : 'Isolated supply line.';

  return {
    updatedLocations,
    updatedEconomy,
    success: true,
    message: `CONSTRUCTED: New ${structureType.toUpperCase()} established. Cost: -${cost} CR. ${connMsg}`,
  };
}
