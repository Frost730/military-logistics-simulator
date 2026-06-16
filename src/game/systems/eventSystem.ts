import type { GameEvent, GameEventType } from '../types';
import { generateId } from '../mapGenerator';

interface EventTemplate {
  title: string;
  description: string;
  type: GameEventType;
  durationTicks: number;
}

const EVENT_TEMPLATES: EventTemplate[] = [
  {
    title: 'FUEL SHORTAGE IN THE SECTOR',
    description: 'A global supply chain failure has triggered a fuel crisis. All unit fuel consumption is DOUBLED.',
    type: 'fuel_crisis',
    durationTicks: 48, // 2 days
  },
  {
    title: 'FLASH FLOOD REPORT',
    description: 'Heavy precipitation has flooded lowlands. Road traversal costs are tripled across the region.',
    type: 'flood',
    durationTicks: 72, // 3 days
  },
  {
    title: 'ELECTROMAGNETIC STORM',
    description: 'Atmospheric interference prevents aircraft flight. All Cargo Aircraft are grounded.',
    type: 'storm',
    durationTicks: 24, // 1 day
  },
  {
    title: 'SATELLITE DOWNLINK FAILURE',
    description: 'A logistics software malfunction has halved tracking speed. All convoys move at 50% speed.',
    type: 'equipment_failure',
    durationTicks: 48, // 2 days
  },
  {
    title: 'REGIONAL DEPOT THEFT',
    description: 'Insurgent activity detected. Minor cargo supplies have been looted from a random depot.',
    type: 'theft',
    durationTicks: 1,
  },
  {
    title: 'BRIDGE COLLAPSE IN SECTOR C',
    description: 'Structural collapse blocks river crossings. Land routes across rivers are completely blocked.',
    type: 'bridge_collapse',
    durationTicks: 48, // 2 days
  },
];

/**
 * Triggers and constructs a random dynamic logistics event
 */
export function triggerRandomEvent(): GameEvent {
  const template = EVENT_TEMPLATES[Math.floor(Math.random() * EVENT_TEMPLATES.length)] || EVENT_TEMPLATES[0];
  
  return {
    id: `evt_${generateId()}`,
    title: template.title,
    description: template.description,
    type: template.type,
    durationTicks: template.durationTicks,
  };
}
