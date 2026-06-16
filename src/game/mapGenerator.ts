import type { MapTile, MapLocation, TerrainType, LocationType, ResourceInventory } from './types';

export const MAP_SIZE = 100;

// Helper to generate a unique ID
export const generateId = () => Math.random().toString(36).substring(2, 9);

export const INITIAL_RESOURCES: ResourceInventory = {
  fuel: 500,
  food: 200,
  ammunition: 100,
  medical: 100,
  spares: 50,
};

export const EMPTY_RESOURCES: ResourceInventory = {
  fuel: 0,
  food: 0,
  ammunition: 0,
  medical: 0,
  spares: 0,
};

export function generateProceduralMap(): { tiles: MapTile[][]; locations: MapLocation[] } {
  const tiles: MapTile[][] = [];

  // 1. Generate background terrain
  for (let x = 0; x < MAP_SIZE; x++) {
    const column: MapTile[] = [];
    for (let y = 0; y < MAP_SIZE; y++) {
      let terrainType: TerrainType = 'plain';

      // Sea on the eastern edge (x > 85)
      if (x > 85) {
        terrainType = 'sea';
      }

      // Mountains in clusters
      // Cluster 1 (North West)
      const distToMtn1 = Math.hypot(x - 20, y - 20);
      if (distToMtn1 < 15 && Math.random() > distToMtn1 / 15) {
        terrainType = 'mountain';
      }

      // Cluster 2 (South West)
      const distToMtn2 = Math.hypot(x - 25, y - 75);
      if (distToMtn2 < 18 && Math.random() > distToMtn2 / 18) {
        terrainType = 'mountain';
      }

      column.push({ x, y, terrainType });
    }
    tiles.push(column);
  }

  // 2. Generate winding rivers flowing from west to east
  // River 1
  let currentY1 = 40;
  for (let x = 0; x <= 85; x++) {
    const deviation = Math.sin(x * 0.1) * 3 + Math.cos(x * 0.05) * 2;
    const y = Math.floor(currentY1 + deviation);
    if (y >= 0 && y < MAP_SIZE) {
      tiles[x][y].terrainType = 'river';
      // Make river 2 tiles wide for visual presence
      if (y + 1 < MAP_SIZE) tiles[x][y + 1].terrainType = 'river';
    }
  }

  // River 2 (tributary starting from south-west mountains and flowing to river 1)
  let currentY2 = 80;
  for (let x = 0; x <= 50; x++) {
    // Flow northeastwards to join River 1 at x = 50, y = 40
    const progress = x / 50;
    const targetY = 40 + Math.sin(50 * 0.1) * 3 + Math.cos(50 * 0.05) * 2;
    const y = Math.floor(currentY2 + (targetY - currentY2) * progress + Math.sin(x * 0.2) * 2);
    if (y >= 0 && y < MAP_SIZE) {
      tiles[x][y].terrainType = 'river';
      if (y + 1 < MAP_SIZE) tiles[x][y + 1].terrainType = 'river';
    }
  }

  // 3. Define strategic locations
  const locationsData: { name: string; type: LocationType; x: number; y: number; owner: 'player' | 'ai' | 'neutral' }[] = [
    { name: 'HQ Command Base', type: 'military_base', x: 10, y: 45, owner: 'player' },
    { name: 'Forward Base Alpha', type: 'military_base', x: 45, y: 25, owner: 'player' },
    { name: 'Outpost Bravo', type: 'military_base', x: 75, y: 15, owner: 'player' },
    { name: 'Garrison Charlie', type: 'military_base', x: 65, y: 80, owner: 'player' },
    { name: 'Sector Delta Base', type: 'military_base', x: 80, y: 48, owner: 'neutral' }, // Disputed base

    { name: 'Metropolis Prime', type: 'city', x: 30, y: 50, owner: 'neutral' },
    { name: 'Weston City', type: 'city', x: 15, y: 12, owner: 'neutral' },
    { name: 'Easton Port', type: 'city', x: 84, y: 55, owner: 'neutral' },

    { name: 'Supply Depot West', type: 'depot', x: 22, y: 46, owner: 'player' },
    { name: 'Supply Depot East', type: 'depot', x: 55, y: 40, owner: 'player' },
    
    { name: 'Refuel Station North', type: 'fuel_station', x: 40, y: 12, owner: 'player' },
    { name: 'Refuel Station South', type: 'fuel_station', x: 45, y: 70, owner: 'player' },
    { name: 'Central Warehouse', type: 'warehouse', x: 35, y: 35, owner: 'player' },

    { name: 'River Port Foxtrot', type: 'port', x: 50, y: 43, owner: 'neutral' },
    { name: 'Sea Port Golf', type: 'port', x: 86, y: 30, owner: 'neutral' },
  ];

  const locations: MapLocation[] = locationsData.map((loc, idx) => {
    // Override terrain of tiles where locations are placed to ensure they are accessible
    const lx = loc.x;
    const ly = loc.y;
    if (loc.type === 'port') {
      // Ports need to be next to water, let's keep river/sea but mark port nearby
      tiles[lx][ly].terrainType = 'plain';
    } else {
      tiles[lx][ly].terrainType = 'plain';
    }

    const maxCapacity = loc.type === 'warehouse' ? 5000 : loc.type === 'depot' ? 2000 : 1000;

    return {
      id: `loc_${idx + 1}`,
      name: loc.name,
      type: loc.type,
      x: lx,
      y: ly,
      resources: { ...INITIAL_RESOURCES },
      maxCapacity,
      owner: loc.owner,
      connectedTo: [],
      consumptionRate: loc.type === 'military_base' ? {
        fuel: 2.0 + Math.random() * 2.0,
        food: 1.5 + Math.random() * 1.5,
        ammunition: 1.0 + Math.random() * 1.0,
        medical: 0.5 + Math.random() * 0.5,
        spares: 0.2 + Math.random() * 0.5,
      } : undefined,
    };
  });

  // 4. Pre-connect some roads and rails in tiles terrain
  // Let's create roads in the tiles grid by setting their terrain type to 'road'
  // Road connecting HQ Base (10,45) -> Depot West (22,46) -> Metropolis Prime (30,50) -> Depot East (55,40)
  createRoadPath(tiles, 10, 45, 22, 46);
  createRoadPath(tiles, 22, 46, 30, 50);
  createRoadPath(tiles, 30, 50, 35, 35); // to Warehouse
  createRoadPath(tiles, 35, 35, 55, 40); // to Depot East
  createRoadPath(tiles, 55, 40, 45, 25); // to Base Alpha
  createRoadPath(tiles, 45, 25, 40, 12); // to Refuel North
  createRoadPath(tiles, 40, 12, 75, 15); // to Outpost Bravo
  createRoadPath(tiles, 30, 50, 45, 70); // to Refuel South
  createRoadPath(tiles, 45, 70, 65, 80); // to Garrison Charlie
  createRoadPath(tiles, 55, 40, 80, 48); // Depot East to Sector Delta Base

  // Let's create rails connecting:
  // Weston City (15,12) -> Metropolis Prime (30,50) -> Easton Port (84,55)
  createRailPath(tiles, 15, 12, 30, 50);
  createRailPath(tiles, 30, 50, 84, 55);

  // Set logical connections for locations
  locations[0].connectedTo.push(locations[8].id); // HQ -> Depot West
  locations[8].connectedTo.push(locations[0].id, locations[5].id); // Depot West -> HQ, Metropolis
  locations[5].connectedTo.push(locations[8].id, locations[12].id); // Metropolis -> Depot West, Warehouse
  locations[12].connectedTo.push(locations[5].id, locations[9].id); // Warehouse -> Metropolis, Depot East
  locations[9].connectedTo.push(locations[12].id, locations[1].id, locations[4].id); // Depot East -> Warehouse, Base Alpha, Delta Base
  locations[1].connectedTo.push(locations[9].id, locations[10].id); // Base Alpha -> Depot East, Refuel North
  locations[10].connectedTo.push(locations[1].id, locations[2].id); // Refuel North -> Base Alpha, Outpost Bravo
  locations[2].connectedTo.push(locations[10].id); // Outpost Bravo -> Refuel North
  locations[11].connectedTo.push(locations[3].id); // Refuel South -> Garrison Charlie
  locations[3].connectedTo.push(locations[11].id); // Garrison Charlie -> Refuel South

  return { tiles, locations };
}

// Draw a straight/simple line of road tiles
function createRoadPath(tiles: MapTile[][], x1: number, y1: number, x2: number, y2: number) {
  let cx = x1;
  let cy = y1;
  while (cx !== x2 || cy !== y2) {
    if (cx < x2) cx++;
    else if (cx > x2) cx--;
    else if (cy < y2) cy++;
    else if (cy > y2) cy--;

    if (tiles[cx][cy].terrainType === 'plain') {
      tiles[cx][cy].terrainType = 'road';
    }
  }
}

// Draw a straight/simple line of rail tiles
function createRailPath(tiles: MapTile[][], x1: number, y1: number, x2: number, y2: number) {
  let cx = x1;
  let cy = y1;
  while (cx !== x2 || cy !== y2) {
    if (cx < x2) cx++;
    else if (cx > x2) cx--;
    else if (cy < y2) cy++;
    else if (cy > y2) cy--;

    // Rails overwrite plains, but keep bridges if they cross rivers
    if (tiles[cx][cy].terrainType === 'plain') {
      tiles[cx][cy].terrainType = 'rail';
    }
  }
}
