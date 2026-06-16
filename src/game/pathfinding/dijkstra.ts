import type { MapLocation } from '../types';

export interface DijkstraResult {
  distances: Record<string, number>;
  predecessors: Record<string, string | null>;
}

// Compute Euclidean distance between two locations
export function getLocationDistance(locA: MapLocation, locB: MapLocation): number {
  return Math.hypot(locA.x - locB.x, locA.y - locB.y);
}

/**
 * Runs Dijkstra's algorithm on the interconnected location graph
 * @param locations The array of MapLocations
 * @param startLocationId The starting location node ID
 */
export function findDijkstraNetworkPaths(
  locations: MapLocation[],
  startLocationId: string
): DijkstraResult {
  const distances: Record<string, number> = {};
  const predecessors: Record<string, string | null> = {};
  const unvisited = new Set<string>();

  // Initialize
  locations.forEach((loc) => {
    distances[loc.id] = Infinity;
    predecessors[loc.id] = null;
    unvisited.add(loc.id);
  });

  if (distances[startLocationId] !== undefined) {
    distances[startLocationId] = 0;
  }

  while (unvisited.size > 0) {
    // Find node with minimum distance
    let currentId: string | null = null;
    let minDistance = Infinity;

    unvisited.forEach((id) => {
      if (distances[id] < minDistance) {
        minDistance = distances[id];
        currentId = id;
      }
    });

    // If unreachable or no nodes left
    if (currentId === null || minDistance === Infinity) {
      break;
    }

    const currentLoc = locations.find((l) => l.id === currentId);
    if (!currentLoc) {
      unvisited.delete(currentId);
      continue;
    }

    unvisited.delete(currentId);

    // Evaluate neighbors
    currentLoc.connectedTo.forEach((neighborId) => {
      if (!unvisited.has(neighborId)) return;

      const neighborLoc = locations.find((l) => l.id === neighborId);
      if (!neighborLoc) return;

      // Cost is the physical distance between base coordinates
      const weight = getLocationDistance(currentLoc, neighborLoc);
      const tentativeDistance = distances[currentId!] + weight;

      if (tentativeDistance < distances[neighborId]) {
        distances[neighborId] = tentativeDistance;
        predecessors[neighborId] = currentId;
      }
    });
  }

  return { distances, predecessors };
}

/**
 * Helper to find the nearest location of a specific type (e.g. 'fuel_station') that has resources
 */
export function findNearestLocationByType(
  locations: MapLocation[],
  startLocationId: string,
  targetType: MapLocation['type'],
  resourceFilter?: { type: keyof MapLocation['resources']; minAmount: number }
): MapLocation | null {
  const dijkstra = findDijkstraNetworkPaths(locations, startLocationId);
  
  let nearestLoc: MapLocation | null = null;
  let minDistance = Infinity;

  locations.forEach((loc) => {
    if (loc.id === startLocationId) return;
    if (loc.type !== targetType) return;

    // Apply resource criteria if provided (e.g. station must have fuel > 50)
    if (resourceFilter) {
      const resVal = loc.resources[resourceFilter.type];
      if (resVal < resourceFilter.minAmount) return;
    }

    const dist = dijkstra.distances[loc.id];
    if (dist < minDistance) {
      minDistance = dist;
      nearestLoc = loc;
    }
  });

  return nearestLoc;
}
