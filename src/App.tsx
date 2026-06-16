import { useState } from 'react';
import { GameStateProvider, useGameState } from './game/gameState';
import MapEngine from './game/MapEngine';
import {
  Shield,
  Play,
  Pause,
  RefreshCw,
  Compass,
  AlertTriangle,
  Activity,
  Truck,
  Plane,
  Anchor,
  Coins,
  Award,
} from 'lucide-react';

function DashboardShell() {
  const {
    state,
    pauseGame,
    resumeGame,
    buyUnit,
    resetGame,
    saveGame,
    loadGame,
    unlockResearch,
    loadCargoToUnit,
    unloadCargoFromUnit,
    buildStructure,
    logMessages,
  } = useGameState();

  const [activeTab, setActiveTab] = useState<'missions' | 'research' | 'statistics'>('missions');
  const [researchCategory, setResearchCategory] = useState<'transport' | 'infrastructure' | 'logistics'>('transport');

  const selectedUnit = state.units.find((u) => u.id === state.selectedUnitId);
  const selectedLoc = state.locations.find((l) => l.id === state.selectedLocationId);

  // Find units parked at the selected location
  const parkedUnits = selectedLoc
    ? state.units.filter((u) => u.currentPosition.x === selectedLoc.x && u.currentPosition.y === selectedLoc.y)
    : [];

  // SVG Chart Calculation for Profit History
  const drawProfitChart = () => {
    const history = state.economy.profitHistory;
    if (history.length < 2) {
      return (
        <div className="h-full w-full flex items-center justify-center text-xs text-gray-500 italic">
          Insufficient economic data. Run clock to chart profits.
        </div>
      );
    }

    const width = 280;
    const height = 90;
    const padding = 10;

    const minX = history[0].tick;
    const maxX = history[history.length - 1].tick;
    const profits = history.map((h) => h.profit);
    const minY = Math.min(...profits, 0) - 100;
    const maxY = Math.max(...profits, 100) + 100;

    const getX = (tick: number) => padding + ((tick - minX) / (maxX - minX)) * (width - 2 * padding);
    const getY = (profit: number) => height - padding - ((profit - minY) / (maxY - minY)) * (height - 2 * padding);

    let pathD = `M ${getX(history[0].tick)} ${getY(history[0].profit)}`;
    for (let i = 1; i < history.length; i++) {
      pathD += ` L ${getX(history[i].tick)} ${getY(history[i].profit)}`;
    }

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full text-cyber-blue">
        {/* Zero baseline */}
        <line
          x1={padding}
          y1={getY(0)}
          x2={width - padding}
          y2={getY(0)}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
          strokeDasharray="2,2"
        />
        {/* Grid outline */}
        <path d={pathD} fill="none" stroke="#00e5ff" strokeWidth="2" />
        {/* Dots */}
        {history.map((h, i) => (
          <circle
            key={i}
            cx={getX(h.tick)}
            cy={getY(h.profit)}
            r="3"
            fill={h.profit >= 0 ? '#00ff66' : '#ff3b30'}
          />
        ))}
      </svg>
    );
  };

  return (
    <div className="min-h-screen w-full bg-cyber-bg text-gray-200 font-sans grid-bg scanline flex flex-col p-4 select-none">
      {/* Header HUD */}
      <header className="flex items-center justify-between border-b border-cyber-border pb-3 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-500/10 border border-cyber-blue rounded">
            <Shield className="h-6 w-6 text-cyber-blue animate-pulse" />
          </div>
          <div>
            <h1 className="font-display font-black text-xl tracking-wider text-white">TACSIT OPERATIONS CENTER</h1>
            <p className="font-mono text-[10px] text-cyber-green flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-cyber-green animate-ping"></span>
              SECURE SATELLITE INTERFACE ACTIVE
            </p>
          </div>
        </div>

        {/* HUD Stats */}
        <div className="flex gap-8 items-center font-mono">
          {/* Day / Time */}
          <div className="text-right">
            <span className="text-gray-500 text-[10px]">TIME DIRECTIVE</span>
            <div className="text-lg text-cyber-blue font-bold tracking-wide">
              DAY {state.dayCount} | {state.tickCount.toString().padStart(2, '0')}:00
            </div>
          </div>

          {/* Efficiency */}
          <div className="text-right">
            <span className="text-gray-500 text-[10px]">LOGISTICS EFFICIENCY</span>
            <div className={`text-lg font-bold tracking-wide ${state.stats.efficiencyScore > 75 ? 'text-cyber-green' : 'text-cyber-red animate-pulse'}`}>
              {state.stats.efficiencyScore.toFixed(0)}%
            </div>
          </div>

          {/* Time Controls */}
          <div className="flex gap-2">
            {state.paused ? (
              <button
                onClick={resumeGame}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyber-green/10 border border-cyber-green hover:bg-cyber-green/20 text-cyber-green rounded text-xs transition-colors cursor-pointer"
              >
                <Play className="h-3.5 w-3.5" /> RESUME
              </button>
            ) : (
              <button
                onClick={pauseGame}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyber-orange/10 border border-cyber-orange hover:bg-cyber-orange/20 text-cyber-orange rounded text-xs transition-colors cursor-pointer"
              >
                <Pause className="h-3.5 w-3.5" /> PAUSE
              </button>
            )}
            <button
              onClick={resetGame}
              className="flex items-center justify-center p-2 bg-gray-800 border border-cyber-border hover:bg-gray-700 text-gray-300 rounded transition-colors cursor-pointer"
              title="Reset System"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4 min-h-0 overflow-hidden">
        {/* Column 1: Command Control & Stats */}
        <div className="flex flex-col gap-4 overflow-y-auto">
          {/* Economy Info */}
          <section className="glass-panel p-4 rounded flex flex-col gap-3">
            <h2 className="font-display font-semibold text-xs text-cyber-blue tracking-wide border-b border-cyber-border pb-1.5 flex items-center justify-between">
              <span>COMMAND BUDGET</span>
              <Coins className="h-4 w-4 text-cyber-blue" />
            </h2>
            <div className="flex justify-between items-baseline">
              <span className="text-gray-400 text-xs font-mono">AVAILABLE CREDITS</span>
              <span className="text-2xl text-cyber-green font-display font-bold">{state.economy.budget.toLocaleString()} CR</span>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                onClick={saveGame}
                className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-cyber-border text-[10px] font-mono text-center rounded transition-colors cursor-pointer"
              >
                SAVE MEMORY
              </button>
              <button
                onClick={loadGame}
                className="px-2 py-1.5 bg-gray-800 hover:bg-gray-700 border border-cyber-border text-[10px] font-mono text-center rounded transition-colors cursor-pointer"
              >
                LOAD MEMORY
              </button>
            </div>
          </section>

          {/* Asset Commissioning */}
          <section className="glass-panel p-4 rounded flex flex-col gap-3">
            <h2 className="font-display font-semibold text-xs text-cyber-blue tracking-wide border-b border-cyber-border pb-1.5 flex items-center justify-between">
              <span>ACQUISITION TERMINAL</span>
              <Award className="h-4 w-4 text-cyber-blue" />
            </h2>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => buyUnit('truck')}
                className="flex items-center justify-between px-3 py-2 bg-gray-800/60 hover:bg-gray-700/60 border border-cyber-border rounded text-xs transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Truck className="h-3.5 w-3.5 text-cyber-orange" /> Truck Convoy
                </span>
                <span className="font-mono text-cyber-green">5,000 CR</span>
              </button>
              <button
                onClick={() => buyUnit('aircraft')}
                className="flex items-center justify-between px-3 py-2 bg-gray-800/60 hover:bg-gray-700/60 border border-cyber-border rounded text-xs transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Plane className="h-3.5 w-3.5 text-cyber-blue" /> Cargo Aircraft
                </span>
                <span className="font-mono text-cyber-green">25,000 CR</span>
              </button>
              <button
                onClick={() => buyUnit('ship')}
                className="flex items-center justify-between px-3 py-2 bg-gray-800/60 hover:bg-gray-700/60 border border-cyber-border rounded text-xs transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <Anchor className="h-3.5 w-3.5 text-blue-500" /> Supply Ship
                </span>
                <span className="font-mono text-cyber-green">18,000 CR</span>
              </button>
            </div>
          </section>

          {/* Active Events Board */}
          <section className="glass-panel p-4 rounded flex flex-col gap-2.5">
            <h2 className="font-display font-semibold text-xs text-cyber-blue tracking-wide border-b border-cyber-border pb-1.5 flex items-center justify-between">
              <span>SECTOR HAZARDS</span>
              <AlertTriangle className="h-4 w-4 text-cyber-orange" />
            </h2>
            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {state.events.map((evt) => (
                <div key={evt.id} className="p-2 bg-red-950/20 border border-red-500/30 rounded flex flex-col gap-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-cyber-red">
                    <span>{evt.title}</span>
                    <span className="font-mono">T-MINUS {evt.durationTicks}</span>
                  </div>
                  <p className="text-[10px] text-gray-400 leading-tight">{evt.description}</p>
                </div>
              ))}
              {state.events.length === 0 && (
                <div className="text-[10px] text-gray-500 italic text-center py-2">No active hazard anomalies detected.</div>
              )}
            </div>
          </section>
        </div>

        {/* Column 2 & 3: Interactive Map & Inspectors */}
        <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
          {/* Map canvas container */}
          <div className="flex-1 min-h-[350px] relative">
            <MapEngine />
          </div>

          {/* Multi-Inspector Panel (Selected Base or Selected Unit) */}
          <div className="h-64 shrink-0 glass-panel p-4 rounded flex flex-col gap-3 overflow-y-auto">
            {selectedLoc ? (
              <div className="flex flex-col gap-3 h-full">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-cyber-border pb-1.5">
                  <div>
                    <h3 className="font-display font-bold text-sm text-white">{selectedLoc.name}</h3>
                    <span className="font-mono text-[10px] text-gray-400 capitalize">
                      COORDS: {selectedLoc.x.toString().padStart(2, '0')}, {selectedLoc.y.toString().padStart(2, '0')} | CLASSIFICATION: {selectedLoc.type.replace('_', ' ')}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono capitalize font-bold ${
                    selectedLoc.owner === 'player' ? 'bg-cyber-green/20 text-cyber-green' : selectedLoc.owner === 'neutral' ? 'bg-cyber-orange/20 text-cyber-orange' : 'bg-purple-500/20 text-purple-400'
                  }`}>
                    {selectedLoc.owner.toUpperCase()} SECTOR
                  </span>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Stockpile reserves */}
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-gray-400 tracking-wider">RESERVES STOCKPILE</div>
                    <div className="flex flex-col gap-1.5">
                      {Object.entries(selectedLoc.resources).map(([res, val]) => (
                        <div key={res} className="flex justify-between items-center text-xs">
                          <span className="text-gray-400 uppercase text-[10px]">{res}</span>
                          <span className="font-bold text-white">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Cargo transfer and construction actions */}
                  <div className="flex flex-col gap-3 border-l border-gray-800 pl-4 justify-between h-full">
                    {/* Parked units transfer */}
                    {parkedUnits.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        <div className="text-[10px] text-cyber-blue font-bold">PARKED CONVOY DETECTED: {parkedUnits[0].name}</div>
                        <div className="flex flex-col gap-1 mt-1 max-h-36 overflow-y-auto pr-1">
                          {(['fuel', 'food', 'ammunition', 'medical', 'spares'] as const).map((res) => (
                            <div key={res} className="flex items-center justify-between gap-1 border-b border-gray-800/40 pb-0.5">
                              <span className="text-[9px] text-gray-400 uppercase w-12 shrink-0">{res.slice(0, 5)}</span>
                              <div className="flex gap-1">
                                <button
                                  onClick={() => loadCargoToUnit(parkedUnits[0].id, res, 50)}
                                  className="px-1.5 py-0.5 bg-gray-850 hover:bg-gray-750 border border-cyber-border rounded text-[9px] font-mono text-center transition-colors cursor-pointer text-cyber-blue font-bold"
                                >
                                  +50
                                </button>
                                <button
                                  onClick={() => unloadCargoFromUnit(parkedUnits[0].id, res, 50)}
                                  className="px-1.5 py-0.5 bg-gray-850 hover:bg-gray-750 border border-cyber-border rounded text-[9px] font-mono text-center transition-colors cursor-pointer text-cyber-orange font-bold"
                                >
                                  -50
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[10px] text-gray-500 italic">No logistics convoys parked at this coordinate.</div>
                    )}

                    {/* Infrastructure Expansion */}
                    {selectedLoc.owner !== 'player' && selectedLoc.type !== 'port' && (
                      <div className="border-t border-gray-800 pt-2.5 flex flex-col gap-1.5">
                        <div className="text-[10px] text-gray-400">EXPAND SUPPLY LINE</div>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <button
                            onClick={() => buildStructure(selectedLoc.id, 'depot')}
                            className="px-2 py-1 bg-cyber-green/10 border border-cyber-green hover:bg-cyber-green/20 text-cyber-green rounded transition-colors cursor-pointer"
                          >
                            DEPOT (8K CR)
                          </button>
                          <button
                            onClick={() => buildStructure(selectedLoc.id, 'fuel_station')}
                            className="px-2 py-1 bg-cyber-blue/10 border border-cyber-blue hover:bg-cyber-blue/20 text-cyber-blue rounded transition-colors cursor-pointer"
                          >
                            STATION (5K CR)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : selectedUnit ? (
              <div className="flex flex-col gap-3 h-full">
                {/* Header */}
                <div className="flex justify-between items-start border-b border-cyber-border pb-1.5">
                  <div>
                    <h3 className="font-display font-bold text-sm text-white">{selectedUnit.name}</h3>
                    <span className="font-mono text-[10px] text-gray-400 capitalize">
                      TYPE: {selectedUnit.type.toUpperCase()} | STATUS: {selectedUnit.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-cyber-green font-bold">
                      SPEED: {selectedUnit.speed} T/S
                    </span>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  {/* Fuel reserves */}
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] text-gray-400">PROPULSION FUEL RESERVES</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 bg-gray-800 h-2 rounded-full overflow-hidden border border-gray-700">
                        <div
                          className="h-full bg-cyber-blue"
                          style={{ width: `${(selectedUnit.fuelRemaining / selectedUnit.fuelMax) * 100}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-white shrink-0">
                        {selectedUnit.fuelRemaining}/{selectedUnit.fuelMax} L
                      </span>
                    </div>

                    {/* Path index info */}
                    {selectedUnit.status === 'moving' && (
                      <div className="text-[10px] text-gray-500 mt-2">
                        Transit Progress: Step {selectedUnit.pathIndex} / {selectedUnit.path.length}
                      </div>
                    )}
                  </div>

                  {/* Cargo listing */}
                  <div className="flex flex-col gap-2 border-l border-gray-800 pl-4">
                    <div className="text-[10px] text-gray-400 uppercase">CARGO WEIGHT: {Object.values(selectedUnit.cargo).reduce((a, b) => a + b, 0)}/{selectedUnit.capacity} TONS</div>
                    <div className="grid grid-cols-2 gap-1.5 mt-1 text-[10px]">
                      {Object.entries(selectedUnit.cargo).map(([res, val]) => (
                        <div key={res} className="flex justify-between pr-2">
                          <span className="text-gray-400 uppercase">{res}</span>
                          <span className="text-white font-bold">{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 gap-2">
                <Compass className="h-8 w-8 text-gray-600 animate-pulse" />
                <div>
                  <div className="font-display font-semibold text-xs text-gray-400">NO ACTIVE INTEL TARGET</div>
                  <p className="text-[10px] max-w-sm mt-1">
                    Select a command base, logistics depot, or moving convoy on the strategic display map to run diagnostic inspection scans.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Column 4: Missions, Upgrades & Logs tabs */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Tab Selector */}
          <div className="flex border-b border-cyber-border shrink-0">
            <button
              onClick={() => setActiveTab('missions')}
              className={`flex-1 py-2 text-center font-display font-semibold text-xs tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'missions'
                  ? 'border-cyber-blue text-white bg-blue-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              MISSIONS
            </button>
            <button
              onClick={() => setActiveTab('research')}
              className={`flex-1 py-2 text-center font-display font-semibold text-xs tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'research'
                  ? 'border-cyber-blue text-white bg-blue-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              UPGRADES
            </button>
            <button
              onClick={() => setActiveTab('statistics')}
              className={`flex-1 py-2 text-center font-display font-semibold text-xs tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === 'statistics'
                  ? 'border-cyber-blue text-white bg-blue-500/5'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              STATS
            </button>
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-3">
            {activeTab === 'missions' && (
              <div className="flex flex-col gap-3">
                {state.missions.map((mis) => (
                  <div key={mis.id} className="p-3 bg-gray-800/40 border border-cyber-border rounded flex flex-col gap-2 hover:border-gray-600 transition-colors">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-xs text-white font-display tracking-wide">{mis.title}</h3>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold uppercase ${
                        mis.status === 'completed'
                          ? 'bg-cyber-green/20 text-cyber-green'
                          : mis.status === 'failed'
                          ? 'bg-cyber-red/20 text-cyber-red'
                          : 'bg-cyber-orange/20 text-cyber-orange'
                      }`}>
                        {mis.status}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 leading-normal">{mis.description}</p>
                    <div className="flex justify-between items-center text-[9px] font-mono text-gray-500 border-t border-gray-800/80 pt-2 mt-1">
                      <span className="flex items-center gap-1"><Coins className="h-3 w-3" /> REWARD: {mis.rewards.money} CR</span>
                      <span className="flex items-center gap-1"><Award className="h-3 w-3" /> EXP: {mis.rewards.experience}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'research' && (
              <div className="flex flex-col gap-3">
                {/* Tech sub-tabs */}
                <div className="flex gap-1 bg-gray-950/40 p-1 border border-cyber-border rounded text-[9px] font-mono">
                  {(['transport', 'infrastructure', 'logistics'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setResearchCategory(cat)}
                      className={`flex-1 py-1 rounded text-center uppercase transition-colors cursor-pointer ${
                        researchCategory === cat ? 'bg-cyber-blue/15 text-cyber-blue font-bold' : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Tech Nodes List */}
                <div className="flex flex-col gap-2.5">
                  {state.research
                    .filter((r) => r.category === researchCategory)
                    .map((node) => {
                      const isLocked = !node.unlocked;
                      const hasPrereq = node.prerequisites.every(
                        (pid) => state.research.find((r) => r.id === pid)?.unlocked
                      );

                      return (
                        <div
                          key={node.id}
                          className={`p-3 border rounded flex flex-col gap-2 transition-colors ${
                            node.unlocked
                              ? 'bg-cyber-blue/5 border-cyber-blue/40'
                              : 'bg-gray-800/20 border-cyber-border'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-bold text-xs text-white">{node.name}</h4>
                              <p className="text-[9px] text-gray-400 mt-0.5">{node.description}</p>
                            </div>
                            <span className="text-[10px] font-mono text-cyber-green shrink-0 font-bold">
                              {node.unlocked ? 'ACTIVE' : `${node.cost} CR`}
                            </span>
                          </div>

                          {isLocked && (
                            <button
                              onClick={() => unlockResearch(node.id)}
                              disabled={!hasPrereq}
                              className={`w-full py-1 text-center font-mono text-[9px] rounded font-bold border transition-colors cursor-pointer ${
                                hasPrereq
                                  ? 'bg-cyber-green/10 border-cyber-green/40 hover:bg-cyber-green/20 text-cyber-green'
                                  : 'bg-gray-800 border-cyber-border text-gray-500 cursor-not-allowed'
                              }`}
                            >
                              {!hasPrereq ? 'PREREQUISITES BLOCKED' : 'COMMISSION UPGRADE'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {activeTab === 'statistics' && (
              <div className="flex flex-col gap-3">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2.5 bg-gray-800/40 border border-cyber-border rounded">
                    <div className="text-[9px] text-gray-500">TOTAL SHIPPED</div>
                    <div className="text-sm font-bold text-white mt-0.5">{state.stats.routesCreated} CONVOYS</div>
                  </div>
                  <div className="p-2.5 bg-gray-800/40 border border-cyber-border rounded">
                    <div className="text-[9px] text-gray-500">FUEL CONSUMED</div>
                    <div className="text-sm font-bold text-cyber-blue mt-0.5">{state.stats.fuelConsumed} L</div>
                  </div>
                </div>

                {/* SVG Profit History graph */}
                <div className="p-3 bg-gray-800/40 border border-cyber-border rounded flex flex-col gap-2">
                  <span className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">PROFIT HISTORY CHART</span>
                  <div className="h-28 w-full border border-gray-900 bg-cyber-bg-darker/60 rounded p-1.5">
                    {drawProfitChart()}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Tactical Log Feed */}
          <section className="h-56 shrink-0 glass-panel p-4 rounded flex flex-col min-h-0">
            <h2 className="font-display font-semibold text-xs text-cyber-blue tracking-wide border-b border-cyber-border pb-1.5 flex items-center gap-2">
              <Activity className="h-3.5 w-3.5 text-cyber-blue animate-pulse" />
              <span>COMMUNICATION TRANSMISSIONS</span>
            </h2>
            <div className="flex-1 overflow-y-auto flex flex-col gap-1.5 mt-2 font-mono text-[10px] pr-1">
              {logMessages.map((log) => (
                <div key={log.id} className="flex gap-1.5 items-start leading-snug border-b border-gray-800/20 pb-1">
                  <span className="text-gray-600 font-bold shrink-0">[{log.timestamp}]</span>
                  <span className={`
                    ${log.type === 'success' ? 'text-cyber-green' : ''}
                    ${log.type === 'warning' ? 'text-cyber-orange' : ''}
                    ${log.type === 'danger' ? 'text-cyber-red animate-pulse font-semibold' : ''}
                    ${log.type === 'info' ? 'text-gray-300' : ''}
                  `}>
                    {log.text}
                  </span>
                </div>
              ))}
              {logMessages.length === 0 && (
                <div className="text-gray-600 italic text-center py-4">No incoming telemetry signals...</div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GameStateProvider>
      <DashboardShell />
    </GameStateProvider>
  );
}
