import type { Mission, MapLocation, ResourceType } from '../types';
import { generateId } from '../mapGenerator';

const RESOURCE_TYPES: ResourceType[] = ['fuel', 'food', 'ammunition', 'medical', 'spares'];

const OPERATION_NAMES = [
  'Sandstorm Delivery',
  'Iron Grid Supply',
  'Deep River Convoy',
  'High Altitude Drop',
  'Silent Ocean Transport',
  'Black Eagle Dispatch',
  'Red Storm Lifeline',
  'Vanguard Supply Run',
];

/**
 * Procedurally generates a new logistics mission
 */
export function generateRandomMission(
  locations: MapLocation[]
): Mission {
  // Find a target location (military base or city)
  const potentialTargets = locations.filter(
    (l) => l.type === 'military_base' || l.type === 'city'
  );
  const target = potentialTargets[Math.floor(Math.random() * potentialTargets.length)] || locations[0];

  const resourceType = RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)];
  const isCity = target.type === 'city';
  
  // Cities request food/medical, bases request fuel/ammunition/spares
  let finalResource = resourceType;
  if (isCity) {
    finalResource = Math.random() > 0.5 ? 'food' : 'medical';
  } else {
    const baseRes: ResourceType[] = ['fuel', 'ammunition', 'spares'];
    finalResource = baseRes[Math.floor(Math.random() * baseRes.length)];
  }

  const amount = Math.floor(100 + Math.random() * 400); // 100 to 500 units
  const missionName = OPERATION_NAMES[Math.floor(Math.random() * OPERATION_NAMES.length)];

  // Reward scales with amount and distance from HQ (loc_1 is x=10, y=45)
  const distFromHQ = Math.hypot(target.x - 10, target.y - 45);
  const rewardMoney = Math.floor((amount * 8 + distFromHQ * 80) * (1.0 + Math.random() * 0.2));
  const rewardExp = Math.floor(rewardMoney * 0.05);

  return {
    id: `mis_${generateId()}`,
    title: `Op: ${missionName}`,
    description: `Deliver ${amount} units of ${finalResource.toUpperCase()} to ${target.name}. Sector requires reinforcement.`,
    type: 'deliver',
    status: 'active',
    requirements: {
      targetLocationId: target.id,
      resourceType: finalResource,
      amount,
    },
    rewards: {
      money: rewardMoney,
      experience: rewardExp,
    },
  };
}
