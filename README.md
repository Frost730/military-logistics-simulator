# TACSIT | Military Logistics Simulator

A browser-based real-time strategy simulation game built with **React**, **TypeScript**, **Tailwind CSS v4**, and **HTML5 Canvas**.

## Gameplay Overview

You act as a **Logistics Commander** directing supply lines, transport routes, and supply depots in a disputed sector. 

- **Interactive Map**: Procedurally generated 100x100 grid with plains, mountain ranges, winding rivers, sea coasts, roads, and rails.
- **Resource Management**: Manage fuel, food, ammunition, medical supplies, and spare parts. Base consumption rates decay reserves over time. Shortages degrade your operational efficiency.
- **Multi-Modal Pathfinding**:
  - **Truck Convoy**: Travels on plains/roads. Roads are cheapest; mountains are expensive; rivers and sea are blocked. Uses **A\*** pathfinding.
  - **Cargo Train**: Traverses along fixed rail routes. Uses **A\*** pathfinding filtered for rails.
  - **Supply Ship**: Moves on rivers and sea. Uses **A\*** pathfinding filtered for water.
  - **Cargo Aircraft**: Flies straight over any terrain but incurs high fuel costs.
- **Supply Network & Construction**: Build Supply Depots, Warehouses, and Fuel Stations to expand storage and link nodes together. Active nodes automatically transfer fuel to idle convoys.
- **Competitor AI**: GLS Corp (Global Logistics Corp) competes for market share by acquiring neutral cities, establishing depots, and claiming open delivery contracts.
- **Dynamic Events**: Weather anomalies (storms grounding flights, flash floods tripling land costs) and regional hazards (bridge collapses, fuel crises) affect path costs in real time.
- **Research Tree**: Spend credits to upgrade axle speeds, diesel engine thermal efficiency, and depot sorting automation.
- **Statistics HUD**: Real-time SVGs tracking profit margins, fuel consumption curves, and delivery stats.

## Tech Stack

1. **Frontend**: React + TypeScript + Vite + Tailwind CSS v4.
2. **Graphics Engine**: HTML5 Canvas API (with translation matrix camera zoom/pan).
3. **Database**: Local Storage auto-saving support.

## Getting Started

### Prerequisites

Make sure you have Node.js installed.

### Installation

1. Navigate to the project root:
   ```bash
   cd military-logistics-simulator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Launch the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```
