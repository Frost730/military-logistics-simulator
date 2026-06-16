import type { Position, UnitType, TerrainType, MapTile, GameEventType } from '../types';
import { MAP_SIZE } from '../mapGenerator';

interface AStarNode {
  x: number;
  y: number;
  g: number; // cost from start
  h: number; // heuristic cost to end
  f: number; // total cost
  parent: AStarNode | null;
}

// Get traversal cost for a specific unit type on a specific terrain
export function getTerrainCost(
  terrain: TerrainType,
  unitType: UnitType,
  activeEvents: GameEventType[] = []
): number {
  if (activeEvents.includes('storm') && unitType === 'aircraft') {
    return Infinity; // aircraft grounded during electromagnetic storm!
  }

  let cost = 10;
  switch (unitType) {
    case 'truck':
      if (terrain === 'road') cost = 2;
      else if (terrain === 'plain') cost = 10;
      else if (terrain === 'rail') cost = 8; // can drive over rail bed, but slow
      else if (terrain === 'mountain') cost = 55; // high cost
      else if (terrain === 'river') cost = Infinity; // blocked
      else if (terrain === 'sea') cost = Infinity; // blocked
      else cost = 10;

      // Flash flood triples road/plain transit cost
      if (activeEvents.includes('flood') && (terrain === 'road' || terrain === 'plain')) {
        cost *= 3;
      }
      break;

    case 'train':
      if (terrain === 'rail') cost = 1; // trains move extremely fast and cheap on rail
      else cost = Infinity; // trains cannot travel on non-rail tiles!
      break;

    case 'ship':
      if (terrain === 'sea') cost = 2;
      else if (terrain === 'river') cost = 5;
      else cost = Infinity; // ships cannot cross land!
      break;

    case 'aircraft':
      cost = 5; // Aircraft flies over everything at a constant rate
      break;

    default:
      cost = 10;
  }

  return cost;
}

// Heuristic: Octile distance for 8-way movement
function heuristic(p1: Position, p2: Position): number {
  const dx = Math.abs(p1.x - p2.x);
  const dy = Math.abs(p1.y - p2.y);
  const D = 1;
  const D2 = Math.SQRT2;
  return D * (dx + dy) + (D2 - 2 * D) * Math.min(dx, dy);
}

export function findAStarPath(
  tiles: MapTile[][],
  start: Position,
  end: Position,
  unitType: UnitType,
  activeEvents: GameEventType[] = []
): Position[] {
  // If start and end are the same
  if (start.x === end.x && start.y === end.y) {
    return [start];
  }

  // Bounds checks
  if (
    start.x < 0 || start.x >= MAP_SIZE ||
    start.y < 0 || start.y >= MAP_SIZE ||
    end.x < 0 || end.x >= MAP_SIZE ||
    end.y < 0 || end.y >= MAP_SIZE
  ) {
    return [];
  }

  const openSet: AStarNode[] = [];
  const closedSet = new Set<string>();

  const startNode: AStarNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: heuristic(start, end),
    f: heuristic(start, end),
    parent: null,
  };

  openSet.push(startNode);

  const getHash = (x: number, y: number) => `${x},${y}`;

  while (openSet.length > 0) {
    // Sort to get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;

    if (current.x === end.x && current.y === end.y) {
      // Reconstruct path
      const path: Position[] = [];
      let curr: AStarNode | null = current;
      while (curr !== null) {
        path.push({ x: curr.x, y: curr.y });
        curr = curr.parent;
      }
      return path.reverse();
    }

    closedSet.add(getHash(current.x, current.y));

    // Neighbors (8-way movement)
    const neighbors = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 },
      { dx: -1, dy: -1 }, { dx: 1, dy: -1 },
      { dx: -1, dy: 1 }, { dx: 1, dy: 1 },
    ];

    for (const offset of neighbors) {
      const nx = current.x + offset.dx;
      const ny = current.y + offset.dy;

      // Bounds check
      if (nx < 0 || nx >= MAP_SIZE || ny < 0 || ny >= MAP_SIZE) {
        continue;
      }

      if (closedSet.has(getHash(nx, ny))) {
        continue;
      }

      const tile = tiles[nx][ny];
      const terrainCost = getTerrainCost(tile.terrainType, unitType, activeEvents);

      if (terrainCost === Infinity) {
        continue; // blocked
      }

      // Calculate step cost (diagonal moves cost slightly more)
      const stepCost = (offset.dx !== 0 && offset.dy !== 0) ? terrainCost * Math.SQRT2 : terrainCost;
      const tentativeG = current.g + stepCost;

      // Check if neighbor is already in open set
      let neighborNode = openSet.find((node) => node.x === nx && node.y === ny);

      if (!neighborNode) {
        const hVal = heuristic({ x: nx, y: ny }, end);
        neighborNode = {
          x: nx,
          y: ny,
          g: tentativeG,
          h: hVal,
          f: tentativeG + hVal,
          parent: current,
        };
        openSet.push(neighborNode);
      } else if (tentativeG < neighborNode.g) {
        neighborNode.g = tentativeG;
        neighborNode.f = tentativeG + neighborNode.h;
        neighborNode.parent = current;
      }
    }
  }

  // If no path was found (e.g. islands or blocked waterways)
  return [];
}
