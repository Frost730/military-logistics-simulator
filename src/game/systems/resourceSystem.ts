import type { MapLocation, Unit, ResourceType } from '../types';

/**
 * Consumes resources at military bases over time
 * Returns updated locations and whether any new shortages were triggered
 */
export function consumeBaseResources(
  locations: MapLocation[]
): { updatedLocations: MapLocation[]; shortagesCount: number; shortageAlerts: string[] } {
  let shortagesCount = 0;
  const shortageAlerts: string[] = [];

  const updatedLocations = locations.map((loc) => {
    if (loc.type === 'military_base' && loc.consumptionRate) {
      const resources = { ...loc.resources };
      let hasShortage = false;
      const shortageResources: string[] = [];

      Object.entries(loc.consumptionRate).forEach(([res, rate]) => {
        const r = res as ResourceType;
        const consumeAmount = rate || 0;

        if (resources[r] >= consumeAmount) {
          resources[r] = parseFloat((resources[r] - consumeAmount).toFixed(1));
        } else {
          if (resources[r] > 0) {
            resources[r] = 0;
          }
          hasShortage = true;
          shortageResources.push(r.toUpperCase());
        }
      });

      if (hasShortage) {
        shortagesCount++;
        shortageAlerts.push(`${loc.name} is experiencing shortages: ${shortageResources.join(', ')}`);
      }

      return {
        ...loc,
        resources,
      };
    }
    return loc;
  });

  return {
    updatedLocations,
    shortagesCount,
    shortageAlerts,
  };
}

/**
 * Automatically refuels units resting at fuel-providing stations
 */
export function autoRefuelUnits(
  units: Unit[],
  locations: MapLocation[]
): { updatedUnits: Unit[]; updatedLocations: MapLocation[]; refuelLogs: string[] } {
  const refuelLogs: string[] = [];
  let currentLocations = [...locations];

  const updatedUnits = units.map((unit) => {
    // Only refuel when idle
    if (unit.status !== 'idle') return unit;

    // Check if unit is resting at a location
    const locationIdx = currentLocations.findIndex(
      (l) => l.x === unit.currentPosition.x && l.y === unit.currentPosition.y
    );

    if (locationIdx === -1) return unit;

    const loc = currentLocations[locationIdx];
    const fuelNeeded = unit.fuelMax - unit.fuelRemaining;

    // Refuel if needed and location has fuel and is player-owned or neutral port
    if (fuelNeeded > 0 && loc.resources.fuel > 0 && (loc.owner === 'player' || loc.type === 'port')) {
      const fuelTransfer = Math.min(fuelNeeded, loc.resources.fuel);
      const roundedTransfer = parseFloat(fuelTransfer.toFixed(1));

      if (roundedTransfer > 0) {
        // Perform transfer
        const updatedLoc = {
          ...loc,
          resources: {
            ...loc.resources,
            fuel: parseFloat((loc.resources.fuel - roundedTransfer).toFixed(1)),
          },
        };
        currentLocations[locationIdx] = updatedLoc;

        refuelLogs.push(`REFUELED: ${unit.name} loaded +${roundedTransfer} Fuel from ${loc.name}.`);

        return {
          ...unit,
          fuelRemaining: parseFloat((unit.fuelRemaining + roundedTransfer).toFixed(1)),
        };
      }
    }

    return unit;
  });

  return {
    updatedUnits,
    updatedLocations: currentLocations,
    refuelLogs,
  };
}
