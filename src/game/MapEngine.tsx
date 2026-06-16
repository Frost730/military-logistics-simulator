import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useGameState } from './gameState';
import type { Position, MapLocation, Unit } from './types';
import { MAP_SIZE } from './mapGenerator';
import { Target, Crosshair, HelpCircle } from 'lucide-react';
import { findAStarPath } from './pathfinding/astar';

const TILE_SIZE = 30; // pixels per grid unit

export default function MapEngine() {
  const { state, selectLocation, selectUnit, assignRouteToUnit, addLogMessage } = useGameState();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Viewport transformation states
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState<Position>({ x: 100, y: 50 });
  const [hoveredTile, setHoveredTile] = useState<Position | null>(null);
  const [hoveredLoc, setHoveredLoc] = useState<MapLocation | null>(null);
  const [hoveredUnit, setHoveredUnit] = useState<Unit | null>(null);

  // State to track route planning mode
  const [routeOrigin, setRouteOrigin] = useState<MapLocation | null>(null);
  const [routeDest, setRouteDest] = useState<MapLocation | null>(null);
  const [planningMode, setPlanningMode] = useState(false);

  // Mouse drag tracking refs
  const dragStartRef = useRef<Position | null>(null);
  const isDraggingRef = useRef(false);

  // Convert screen coordinates to grid coordinates
  const screenToGrid = useCallback((screenX: number, screenY: number): Position => {
    const gridX = (screenX - pan.x) / (zoom * TILE_SIZE);
    const gridY = (screenY - pan.y) / (zoom * TILE_SIZE);
    return {
      x: Math.floor(gridX),
      y: Math.floor(gridY),
    };
  }, [pan, zoom]);


  // Draw the entire map canvas
  const drawMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#060810';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Apply pan and zoom
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    // 1. Draw Grid Lines (tactical mesh)
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= MAP_SIZE; x += 2) {
      ctx.beginPath();
      ctx.moveTo(x * TILE_SIZE, 0);
      ctx.lineTo(x * TILE_SIZE, MAP_SIZE * TILE_SIZE);
      ctx.stroke();
    }
    for (let y = 0; y <= MAP_SIZE; y += 2) {
      ctx.beginPath();
      ctx.moveTo(0, y * TILE_SIZE);
      ctx.lineTo(MAP_SIZE * TILE_SIZE, y * TILE_SIZE);
      ctx.stroke();
    }

    // 2. Draw Terrains
    // To speed up rendering, we scan tiles and render mountains, rivers, seas
    for (let x = 0; x < MAP_SIZE; x++) {
      for (let y = 0; y < MAP_SIZE; y++) {
        const tile = state.tiles[x]?.[y];
        if (!tile) continue;

        const tx = x * TILE_SIZE;
        const ty = y * TILE_SIZE;

        if (tile.terrainType === 'sea') {
          ctx.fillStyle = 'rgba(30, 58, 138, 0.4)';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        } else if (tile.terrainType === 'mountain') {
          // Draw tactical triangle for mountains
          ctx.strokeStyle = 'rgba(107, 114, 128, 0.4)';
          ctx.fillStyle = 'rgba(75, 85, 99, 0.15)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(tx + TILE_SIZE / 2, ty + 2);
          ctx.lineTo(tx + TILE_SIZE - 2, ty + TILE_SIZE - 2);
          ctx.lineTo(tx + 2, ty + TILE_SIZE - 2);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        } else if (tile.terrainType === 'river') {
          ctx.fillStyle = 'rgba(0, 229, 255, 0.25)';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
        } else if (tile.terrainType === 'road') {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          // Small center line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(tx + TILE_SIZE / 2, ty);
          ctx.lineTo(tx + TILE_SIZE / 2, ty + TILE_SIZE);
          ctx.stroke();
          ctx.setLineDash([]);
        } else if (tile.terrainType === 'rail') {
          ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
          ctx.fillRect(tx, ty, TILE_SIZE, TILE_SIZE);
          // Rail cross-hatching
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.3)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(tx + TILE_SIZE / 2, ty);
          ctx.lineTo(tx + TILE_SIZE / 2, ty + TILE_SIZE);
          ctx.stroke();
          
          // Ties
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let offset = 4; offset < TILE_SIZE; offset += 8) {
            ctx.moveTo(tx + TILE_SIZE / 2 - 4, ty + offset);
            ctx.lineTo(tx + TILE_SIZE / 2 + 4, ty + offset);
          }
          ctx.stroke();
        }
      }
    }

    // 3. Draw Supply Network Lines
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.3)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 5]);
    state.locations.forEach((loc) => {
      loc.connectedTo.forEach((connId) => {
        const dest = state.locations.find((l) => l.id === connId);
        if (dest) {
          ctx.beginPath();
          ctx.moveTo(loc.x * TILE_SIZE + TILE_SIZE / 2, loc.y * TILE_SIZE + TILE_SIZE / 2);
          ctx.lineTo(dest.x * TILE_SIZE + TILE_SIZE / 2, dest.y * TILE_SIZE + TILE_SIZE / 2);
          ctx.stroke();
        }
      });
    });
    ctx.setLineDash([]);

    // 4. Draw Unit Paths (if any unit is selected and moving)
    if (state.selectedUnitId) {
      const unit = state.units.find((u) => u.id === state.selectedUnitId);
      if (unit && unit.path.length > 0) {
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        unit.path.forEach((pt, idx) => {
          const px = pt.x * TILE_SIZE + TILE_SIZE / 2;
          const py = pt.y * TILE_SIZE + TILE_SIZE / 2;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();

        // Draw destination beacon
        const dest = unit.path[unit.path.length - 1];
        if (dest) {
          const dx = dest.x * TILE_SIZE + TILE_SIZE / 2;
          const dy = dest.y * TILE_SIZE + TILE_SIZE / 2;
          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(dx, dy, 12, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
          ctx.beginPath();
          ctx.arc(dx, dy, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // 5. Draw Locations (nodes)
    state.locations.forEach((loc) => {
      const lx = loc.x * TILE_SIZE + TILE_SIZE / 2;
      const ly = loc.y * TILE_SIZE + TILE_SIZE / 2;
      const size = 10;

      // Outer rings
      const isSelected = state.selectedLocationId === loc.id;
      const isRouteOrigin = routeOrigin?.id === loc.id;
      const isRouteDest = routeDest?.id === loc.id;

      if (isSelected) {
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lx, ly, size + 8, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isRouteOrigin) {
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lx, ly, size + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (isRouteDest) {
        ctx.strokeStyle = '#ff9500';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lx, ly, size + 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw node shape based on type
      if (loc.type === 'military_base') {
        ctx.fillStyle = loc.owner === 'player' ? '#ff3b30' : loc.owner === 'neutral' ? '#ff9500' : '#a855f7';
        ctx.fillRect(lx - size, ly - size, size * 2, size * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(lx - size, ly - size, size * 2, size * 2);
      } else if (loc.type === 'warehouse') {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(lx, ly - size - 2);
        ctx.lineTo(lx + size + 2, ly);
        ctx.lineTo(lx, ly + size + 2);
        ctx.lineTo(lx - size - 2, ly);
        ctx.closePath();
        ctx.fill();
      } else if (loc.type === 'depot') {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(lx, ly, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.stroke();
      } else if (loc.type === 'fuel_station') {
        ctx.fillStyle = '#eab308';
        ctx.beginPath();
        ctx.arc(lx, ly, size - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#000';
        ctx.stroke();
      } else if (loc.type === 'port') {
        ctx.fillStyle = '#06b6d4';
        ctx.fillRect(lx - size + 2, ly - size + 2, (size - 2) * 2, (size - 2) * 2);
      } else {
        // City
        ctx.fillStyle = '#a1a1aa';
        ctx.beginPath();
        ctx.arc(lx, ly, size - 1, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw names if zoomed in enough
      if (zoom > 0.5) {
        ctx.fillStyle = '#f3f4f6';
        ctx.font = 'bold 9px Orbitron, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(loc.name, lx, ly - size - 6);
      }
    });

    // 6. Draw Units
    state.units.forEach((unit) => {
      const ux = unit.currentPosition.x * TILE_SIZE + TILE_SIZE / 2;
      const uy = unit.currentPosition.y * TILE_SIZE + TILE_SIZE / 2;
      const isSelected = state.selectedUnitId === unit.id;

      if (isSelected) {
        ctx.strokeStyle = '#00ff66';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(ux, uy, 12, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Color coding units: air=cyan, ship=blue, truck=orange, train=yellow
      let unitColor = '#ff9500';
      if (unit.type === 'aircraft') unitColor = '#00e5ff';
      if (unit.type === 'ship') unitColor = '#3b82f6';
      if (unit.type === 'train') unitColor = '#eab308';

      ctx.fillStyle = unitColor;

      if (unit.type === 'aircraft') {
        // Draw triangular plane
        ctx.beginPath();
        ctx.moveTo(ux, uy - 7);
        ctx.lineTo(ux + 6, uy + 6);
        ctx.lineTo(ux - 6, uy + 6);
        ctx.closePath();
        ctx.fill();
      } else if (unit.type === 'ship') {
        // Boat shape
        ctx.beginPath();
        ctx.arc(ux, uy, 5, 0, Math.PI, false);
        ctx.closePath();
        ctx.fill();
      } else {
        // Box
        ctx.fillRect(ux - 5, uy - 5, 10, 10);
      }

      // Show unit name labels
      if (zoom > 0.6) {
        ctx.fillStyle = unitColor;
        ctx.font = '10px "Share Tech Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(unit.name.split(' ')[0], ux, uy + 15);
      }
    });

    // 7. Draw Route Planner Preview Line (in planning mode)
    if (planningMode && routeOrigin && hoveredTile && state.selectedUnitId) {
      const selectedUnit = state.units.find((u) => u.id === state.selectedUnitId);
      if (selectedUnit) {
        const activeEventTypes = state.events.map((e) => e.type);
        const previewPath = findAStarPath(state.tiles, routeOrigin, hoveredTile, selectedUnit.type, activeEventTypes);
        
        if (previewPath.length > 0) {
          ctx.strokeStyle = '#00ff66';
          ctx.lineWidth = 2;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          previewPath.forEach((pt, idx) => {
            const px = pt.x * TILE_SIZE + TILE_SIZE / 2;
            const py = pt.y * TILE_SIZE + TILE_SIZE / 2;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
    }

    ctx.restore();
  }, [state, zoom, pan, routeOrigin, routeDest, planningMode, hoveredTile]);

  // Adjust canvas bounds on resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resizeObserver = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      drawMap();
    });
    resizeObserver.observe(parent);

    return () => resizeObserver.disconnect();
  }, [drawMap]);

  // Trigger draw when state or coordinates shift
  useEffect(() => {
    drawMap();
  }, [drawMap]);

  // Mouse handlers for dragging/clicking
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Handle Panning drag
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.hypot(dx, dy) > 4) {
        isDraggingRef.current = true;
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        dragStartRef.current = { x: e.clientX, y: e.clientY };
      }
    }

    // 2. Track Grid Hovering
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    const gridPos = screenToGrid(clientX, clientY);

    if (gridPos.x >= 0 && gridPos.x < MAP_SIZE && gridPos.y >= 0 && gridPos.y < MAP_SIZE) {
      setHoveredTile(gridPos);

      // Check hover locations
      const loc = state.locations.find((l) => l.x === gridPos.x && l.y === gridPos.y);
      setHoveredLoc(loc || null);

      // Check hover units
      const unit = state.units.find((u) => u.currentPosition.x === gridPos.x && u.currentPosition.y === gridPos.y);
      setHoveredUnit(unit || null);
    } else {
      setHoveredTile(null);
      setHoveredLoc(null);
      setHoveredUnit(null);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    dragStartRef.current = null;
    if (isDraggingRef.current) return; // ignore click actions if panning

    // Handle map clicks
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const gridPos = screenToGrid(clickX, clickY);

    // Find clicked location
    const clickedLoc = state.locations.find((l) => l.x === gridPos.x && l.y === gridPos.y);
    // Find clicked unit
    const clickedUnit = state.units.find((u) => u.currentPosition.x === gridPos.x && u.currentPosition.y === gridPos.y);

    if (planningMode) {
      // In route planning mode
      if (clickedLoc) {
        if (!routeOrigin) {
          setRouteOrigin(clickedLoc);
          addLogMessage(`Route origin set: ${clickedLoc.name}. Select destination.`, 'info');
        } else if (clickedLoc.id !== routeOrigin.id) {
          setRouteDest(clickedLoc);
          addLogMessage(`Route destination set: ${clickedLoc.name}`, 'info');
          
          const selectedUnit = state.units.find((u) => u.id === state.selectedUnitId);
          if (selectedUnit) {
            const activeEventTypes = state.events.map((e) => e.type);
            const realPath = findAStarPath(state.tiles, routeOrigin, clickedLoc, selectedUnit.type, activeEventTypes);
            if (realPath.length > 0) {
              assignRouteToUnit(selectedUnit.id, realPath, routeOrigin.id, clickedLoc.id);
              setPlanningMode(false);
              setRouteOrigin(null);
              setRouteDest(null);
            } else {
              addLogMessage(`ROUTE UNFEASIBLE: Impassable terrain barriers for ${selectedUnit.type.toUpperCase()}!`, 'danger');
            }
          }
        }
      } else {
        // Clicked empty ground: Cancel route planning
        setPlanningMode(false);
        setRouteOrigin(null);
        setRouteDest(null);
        addLogMessage('Route planning cancelled.', 'warning');
      }
    } else {
      // Normal selection mode
      if (clickedUnit) {
        selectUnit(clickedUnit.id);
        addLogMessage(`Selected Logistics Unit: ${clickedUnit.name}`, 'info');
      } else if (clickedLoc) {
        selectLocation(clickedLoc.id);
        addLogMessage(`Selected Command Location: ${clickedLoc.name}`, 'info');
      } else {
        // Clear selections
        selectUnit(null);
        selectLocation(null);
      }
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const newZoom = e.deltaY < 0 ? zoom * zoomFactor : zoom / zoomFactor;
    // Bounds check
    const clampedZoom = Math.max(0.15, Math.min(newZoom, 4.0));
    setZoom(clampedZoom);
  };

  const enterRoutePlanning = () => {
    if (!state.selectedUnitId) {
      addLogMessage('SELECT UNIT FIRST: Pick a logistics vehicle to plot routes.', 'warning');
      return;
    }
    setPlanningMode(true);
    setRouteOrigin(null);
    setRouteDest(null);
    addLogMessage('ROUTE PLOTTING INITIALIZED: Click origin base/city, then click destination.', 'info');
  };

  return (
    <div className="w-full h-full flex flex-col relative bg-cyber-bg-darker border border-cyber-border rounded overflow-hidden">
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="flex-1 cursor-grab active:cursor-grabbing"
      />

      {/* Map Control overlay (top right) */}
      <div className="absolute top-3 right-3 flex flex-col gap-2 z-10 font-mono text-xs">
        <div className="glass-panel px-3 py-2 rounded flex flex-col gap-1 text-right text-gray-300">
          <div>ZOOM: {(zoom * 100).toFixed(0)}%</div>
          <div className="text-[10px] text-gray-500">DRAG TO PAN • WHEEL TO ZOOM</div>
        </div>

        {state.selectedUnitId && (
          <button
            onClick={enterRoutePlanning}
            className={`px-3 py-2 rounded font-semibold border text-center transition-colors cursor-pointer ${
              planningMode
                ? 'bg-cyber-green/20 border-cyber-green text-cyber-green'
                : 'bg-cyber-blue/10 border-cyber-blue text-cyber-blue hover:bg-cyber-blue/20'
            }`}
          >
            {planningMode ? 'PLANNING ROUTE...' : 'DISPATCH ROUTE'}
          </button>
        )}
      </div>

      {/* Map Inspector Panel (bottom overlay) */}
      <div className="absolute bottom-3 left-3 right-3 z-10 flex gap-2 font-mono text-xs">
        {/* Cursor coords info */}
        <div className="glass-panel px-3 py-2.5 rounded shrink-0 flex items-center gap-2 text-gray-300">
          <Crosshair className="h-4 w-4 text-cyber-blue" />
          <div>
            <div className="text-[10px] text-gray-500">CURSOR POSITION</div>
            <div className="font-bold text-white">
              {hoveredTile ? `${hoveredTile.x.toString().padStart(2, '0')}, ${hoveredTile.y.toString().padStart(2, '0')}` : 'OFF GRID'}
            </div>
          </div>
        </div>

        {/* Hover inspector */}
        <div className="glass-panel px-4 py-2.5 rounded flex-1 flex items-center justify-between text-gray-300 min-h-[46px]">
          {hoveredLoc ? (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-cyber-blue animate-ping"></div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase">LOCATION HIGHLIGHT: {hoveredLoc.type.replace('_', ' ')}</span>
                <div className="font-bold text-white text-sm">{hoveredLoc.name}</div>
              </div>
            </div>
          ) : hoveredUnit ? (
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-cyber-green animate-ping"></div>
              <div>
                <span className="text-[10px] text-gray-500 uppercase">ASSET HIGHLIGHT: {hoveredUnit.type.toUpperCase()}</span>
                <div className="font-bold text-white text-sm">
                  {hoveredUnit.name} ({hoveredUnit.status})
                </div>
              </div>
            </div>
          ) : hoveredTile ? (
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-gray-600" />
              <div>
                <span className="text-[10px] text-gray-500 uppercase">TERRAIN SURVEY</span>
                <div className="font-semibold text-gray-400 capitalize">
                  {state.tiles[hoveredTile.x]?.[hoveredTile.y]?.terrainType || 'plain'}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 italic flex items-center gap-2">
              <Crosshair className="h-4 w-4" /> Hover cursor over map sectors to run surveillance scans.
            </div>
          )}

          {/* Quick HUD for status indicator */}
          {planningMode && (
            <div className="flex items-center gap-2 text-cyber-green animate-pulse">
              <Target className="h-4 w-4" />
              <span className="font-semibold">PLOT MODE ACTIVE</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
