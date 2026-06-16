import type { Position, UnitType, MapTile } from '../types';
import { findAStarPath } from '../pathfinding/astar';

export interface RouteEstimates {
  path: Position[];
  distance: number; // in tiles
  fuelCost: number; // in fuel units
  travelTime: number; // in seconds/ticks
  isReachable: boolean;
}

/**
 * Calculates detailed route specifications and previews before committing dispatch
 */
export function estimateRouteStats(
  tiles: MapTile[][],
  origin: Position,
  destination: Position,
  unitType: UnitType,
  fuelConsumptionPerTile: number,
  speedPerTick: number,
  fuelEfficiencyUpgradeUnlocked: boolean = false
): RouteEstimates {
  const path = findAStarPath(tiles, origin, destination, unitType);

  if (path.length === 0) {
    return {
      path: [],
      distance: 0,
      fuelCost: 0,
      travelTime: 0,
      isReachable: false,
    };
  }

  // Distance is path length - 1 (transitions between cells)
  const distance = path.length - 1;

  // Apply engine research discount if unlocked (20% reduction)
  const engineModifier = fuelEfficiencyUpgradeUnlocked ? 0.8 : 1.0;
  const fuelCost = parseFloat((distance * fuelConsumptionPerTile * engineModifier).toFixed(1));

  // Time ticks = distance / speed
  const travelTime = Math.ceil(distance / speedPerTick);

  return {
    path,
    distance,
    fuelCost,
    travelTime,
    isReachable: true,
  };
}
