import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameStatus, GameMode, Difficulty, Player, Puck, DIFFICULTY_CONFIG } from '../types';
import * as Constants from '../constants';
import { GameMenu } from './GameMenu';

const INITIAL_POS = { x: 0, y: 0 }; // Placeholder, set on resize

export const AirHockey: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  
  // -- Game State (Refs for performance in loop) --
  const gameState = useRef({
    puck: { pos: { ...INITIAL_POS }, velocity: { x: 0, y: 0 } } as Puck,
    p1: { pos: { ...INITIAL_POS }, prevPos: { ...INITIAL_POS }, velocity: { x: 0, y: 0 }, score: 0 } as Player,
    p2: { pos: { ...INITIAL_POS }, prevPos: { ...INITIAL_POS }, velocity: { x: 0, y: 0 }, score: 0 } as Player,
    status: GameStatus.MENU,
    mode: GameMode.MULTI_PLAYER, // Default to multi until set
    difficulty: Difficulty.MEDIUM,
    dimensions: { width: 0, height: 0, deadZoneTop: 0, deadZoneBottom: 0 },
    timeLeft: Constants.GAME_DURATION_SEC,
    lastTick: 0,
    ai: {
      state: 'DEFEND',
      smoothTarget: { x: 0, y: 0 },
      stuckTimer: 0,
      reactionTimer: 0,
      lastKnownPuck: { x: 0, y: 0 },
      mistakeOffset: 0,
    }
  });

  // -- UI State (React state for renders) --
  const [uiState, setUiState] = useState({
    status: GameStatus.MENU,
    scoreP1: 0,
    scoreP2: 0,
    timeLeft: Constants.GAME_DURATION_SEC,
    highScore: parseInt(localStorage.getItem('neonHockeyHighScore') || '0'),
    winner: null as string | null,
    mode: null as 'single' | 'multi' | null
  });

  // Helper to sync ref to state infrequently
  const syncUi = useCallback((winnerOverride?: string) => {
    const s = gameState.current;
    setUiState(prev => ({
      ...prev,
      status: s.status,
      scoreP1: s.p1.score,
      scoreP2: s.p2.score,
      timeLeft: s.timeLeft,
      mode: s.mode === GameMode.SINGLE_PLAYER ? 'single' : 'multi',
      winner: winnerOverride || prev.winner
    }));
  }, []);

  // --- Core Logic Helpers ---

  const resetPositions = () => {
    const { width, height } = gameState.current.dimensions;
    if (!width || !height) return;

    const s = gameState.current;
    s.puck.pos = { x: width / 2, y: height / 2 };
    s.puck.velocity = { x: 0, y: 0 };
    
    s.p1.pos = { x: width / 2, y: height - 150 };
    s.p1.prevPos = { ...s.p1.pos };
    s.p1.velocity = { x: 0, y: 0 };

    s.p2.pos = { x: width / 2, y: 150 };
    s.p2.prevPos = { ...s.p2.pos };
    s.p2.velocity = { x: 0, y: 0 };

    // Reset AI
    s.ai = {
      state: 'DEFEND',
      smoothTarget: { x: width / 2, y: 150 },
      stuckTimer: 0,
      reactionTimer: 0,
      lastKnownPuck: { x: width / 2, y: height / 2 },
      mistakeOffset: 0,
    };
  };

  const resetPuck = (scorer: 'p1' | 'p2') => {
    const { width, height } = gameState.current.dimensions;
    const s = gameState.current;
    s.puck.pos.x = width / 2;
    s.puck.velocity = { x: 0, y: 0 };
    const offset = 40;
    if (scorer === 'p1') s.puck.pos.y = height / 2 - offset; // P2 starts
    else s.puck.pos.y = height / 2 + offset; // P1 starts
    
    s.ai.stuckTimer = 0;
    s.ai.reactionTimer = 0;
  };

  const resize = () => {
    if (!canvasRef.current || !containerRef.current) return;
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    canvasRef.current.width = width;
    canvasRef.current.height = height;

    const zoneHeight = height * Constants.DEAD_ZONE_PCT;
    const deadZoneTop = (height / 2) - (zoneHeight / 2);
    const deadZoneBottom = (height / 2) + (zoneHeight / 2);

    gameState.current.dimensions = { width, height, deadZoneTop, deadZoneBottom };

    // Only reset positions if we are not in the middle of a game to avoid jarring resets on mobile toolbar toggles
    if (gameState.current.status === GameStatus.MENU) {
      resetPositions();
    }
  };

  // --- Physics Engine ---

  const checkCollision = (player: Player) => {
    const puck = gameState.current.puck;
    const dx = puck.pos.x - player.pos.x;
    const dy = puck.pos.y - player.pos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = Constants.PADDLE_RADIUS + Constants.PUCK_RADIUS;

    if (dist < minDist) {
      // Collision detected
      // 1. Resolve overlap
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      
      puck.pos.x += nx * overlap;
      puck.pos.y += ny * overlap;

      // 2. Transfer velocity (Elastic-ish)
      // Simple physics approximation for air hockey feel
      const forceMultiplier = 1.15;
      
      // Blend puck existing velocity with paddle hit velocity
      puck.velocity.x = (puck.velocity.x * 0.4) + (player.velocity.x * forceMultiplier);
      puck.velocity.y = (puck.velocity.y * 0.4) + (player.velocity.y * forceMultiplier);

      // Add minimum bounce if paddle is stationary but puck hits it
      if (Math.abs(player.velocity.x) < 1 && Math.abs(player.velocity.y) < 1) {
         const speed = Math.sqrt(puck.velocity.x ** 2 + puck.velocity.y ** 2);
         puck.velocity.x += nx * speed * 0.6;
         puck.velocity.y += ny * speed * 0.6;
      }

      // Cap speed
      const speed = Math.sqrt(puck.velocity.x ** 2 + puck.velocity.y ** 2);
      if (speed > Constants.MAX_SPEED) {
         const scale = Constants.MAX_SPEED / speed;
         puck.velocity.x *= scale;
         puck.velocity.y *= scale;
      }
      
      gameState.current.ai.stuckTimer = 0; // Unstuck if hit
    }
  };

  const updateAI = () => {
     const s = gameState.current;
     if (s.mode !== GameMode.SINGLE_PLAYER || s.status !== GameStatus.PLAYING) return;
     
     const settings = DIFFICULTY_CONFIG[s.difficulty];
     const { width, height, deadZoneTop } = s.dimensions;
     const cpuBaseY = 150;
     const paddleLimitY = deadZoneTop - Constants.PADDLE_RADIUS;

     const puckSpeed = Math.sqrt(s.puck.velocity.x ** 2 + s.puck.velocity.y ** 2);
     const isStuck = puckSpeed < 1.0;
     const isThreat = s.puck.pos.y < height / 2;

     if (isStuck && s.puck.pos.y < height / 2 + 50) s.ai.stuckTimer++;
     else s.ai.stuckTimer = 0;

     // Reaction delay
     s.ai.reactionTimer--;
     if (s.ai.reactionTimer <= 0) {
        s.ai.lastKnownPuck = { ...s.puck.pos };
        s.ai.mistakeOffset = (Math.random() - 0.5) * settings.errorMargin;
        
        // Calculate urgency
        const dist = Math.abs(s.puck.pos.y - s.p2.pos.y);
        const urgency = Math.max(0, 1 - (dist / (height/2)));
        const delayFrames = Math.floor(settings.reactionBase - (urgency * 5));
        s.ai.reactionTimer = Math.max(3, delayFrames);
     }

     const perceivedX = s.ai.lastKnownPuck.x + s.ai.mistakeOffset;
     const perceivedY = s.ai.lastKnownPuck.y;
     
     let targetX = width / 2;
     let targetY = cpuBaseY;
     let speedFactor = settings.baseSpeed;

     if (s.ai.stuckTimer > 60) {
        // Go hit stuck puck
        targetX = perceivedX;
        targetY = perceivedY;
        speedFactor = settings.baseSpeed * 0.8;
     } else if (isThreat) {
        if (perceivedY < s.p2.pos.y) {
           // Puck is behind AI! panic retreat
           targetX = width / 2;
           targetY = cpuBaseY;
           speedFactor = settings.baseSpeed * 2;
        } else {
           // Intercept
           const predictedX = perceivedX + s.puck.velocity.x * 10;
           targetX = predictedX;
           targetY = perceivedY - 30; // Aim slightly behind puck to hit it forward
           
           // Aggressive shot if close
           if (Math.abs(perceivedY - s.p2.pos.y) < 100) {
              targetY = perceivedY + 60; // Push through
              speedFactor = settings.shotSpeed;
           }
        }
     } else {
        // Idle tracking
        targetX = (width / 2 + perceivedX) / 2;
        targetY = cpuBaseY;
     }

     // Smooth movement
     s.ai.smoothTarget.x += (targetX - s.ai.smoothTarget.x) * 0.15;
     s.ai.smoothTarget.y += (targetY - s.ai.smoothTarget.y) * 0.15;
     
     s.p2.pos.x += (s.ai.smoothTarget.x - s.p2.pos.x) * speedFactor;
     s.p2.pos.y += (s.ai.smoothTarget.y - s.p2.pos.y) * speedFactor;

     // Clamp AI
     let limitY = paddleLimitY;
     if (s.ai.stuckTimer > 60 || (isThreat && perceivedY < height/2)) {
         limitY = (height / 2) - Constants.PADDLE_RADIUS; // Can go deeper if needed
     }

     if (s.p2.pos.y > limitY) s.p2.pos.y = limitY;
     if (s.p2.pos.y < Constants.PADDLE_RADIUS) s.p2.pos.y = Constants.PADDLE_RADIUS;
     if (s.p2.pos.x < Constants.PADDLE_RADIUS) s.p2.pos.x = Constants.PADDLE_RADIUS;
     if (s.p2.pos.x > width - Constants.PADDLE_RADIUS) s.p2.pos.x = width - Constants.PADDLE_RADIUS;
  };

  const update = () => {
    const s = gameState.current;
    if (s.status !== GameStatus.PLAYING) return;
    const { width, height } = s.dimensions;

    // Timer logic for single player
    if (s.mode === GameMode.SINGLE_PLAYER) {
      const now = Date.now();
      if (now - s.lastTick >= 1000) {
        s.timeLeft--;
        s.lastTick = now;
        syncUi(); // Update UI timer
        
        if (s.timeLeft <= 0) {
          endGame();
          return;
        }
      }
    }

    // AI
    updateAI();

    // Update Player Velocities (derived from position change)
    const updateVelocity = (p: Player) => {
      p.velocity.x = p.pos.x - p.prevPos.x;
      p.velocity.y = p.pos.y - p.prevPos.y;
      p.prevPos = { ...p.pos };
    };
    updateVelocity(s.p1);
    updateVelocity(s.p2);

    // Update Puck
    const puck = s.puck;
    // Sub-steps for collision precision
    const steps = 5;
    for (let i = 0; i < steps; i++) {
        puck.pos.x += puck.velocity.x / steps;
        puck.pos.y += puck.velocity.y / steps;

        // Wall collisions
        if (puck.pos.x < Constants.PUCK_RADIUS) {
            puck.pos.x = Constants.PUCK_RADIUS;
            puck.velocity.x *= -1;
        }
        if (puck.pos.x > width - Constants.PUCK_RADIUS) {
            puck.pos.x = width - Constants.PUCK_RADIUS;
            puck.velocity.x *= -1;
        }

        // Goal Logic
        const goalW = width * Constants.GOAL_SIZE_RATIO;
        const goalLeft = (width - goalW) / 2;
        const goalRight = (width + goalW) / 2;
        let goalScored = false;

        // Top Goal (P2 side)
        if (puck.pos.y < Constants.PUCK_RADIUS) {
            if (puck.pos.x > goalLeft && puck.pos.x < goalRight) {
                s.p1.score++;
                goalScored = true;
                resetPuck('p1');
                syncUi();
            } else {
                puck.pos.y = Constants.PUCK_RADIUS;
                puck.velocity.y *= -1;
            }
        }
        // Bottom Goal (P1 side)
        else if (puck.pos.y > height - Constants.PUCK_RADIUS) {
             if (puck.pos.x > goalLeft && puck.pos.x < goalRight) {
                s.p2.score++;
                goalScored = true;
                resetPuck('p2');
                syncUi();
            } else {
                puck.pos.y = height - Constants.PUCK_RADIUS;
                puck.velocity.y *= -1;
            }
        }

        if (goalScored) break;

        // Paddle collisions
        checkCollision(s.p1);
        checkCollision(s.p2);
    }

    // Friction & random drift
    puck.velocity.x *= Constants.FRICTION;
    puck.velocity.y *= Constants.FRICTION;
    
    // Add tiny random jitter to prevent perfect straight vertical loops
    if (Math.abs(puck.velocity.y) > 0.5) {
       puck.velocity.x += (Math.random() - 0.5) * 0.05;
    }

    // Slope/Gravity in dead zone?
    // Adding slight slope to prevent puck stalling in center
    if (puck.pos.y > s.dimensions.deadZoneTop && puck.pos.y < s.dimensions.deadZoneBottom) {
       const slope = 0.02;
       if (puck.pos.y < height / 2) puck.velocity.y -= slope;
       else puck.velocity.y += slope;
    }

    // Corner Blowers
    const cs = Constants.CORNER_BLOWER_SIZE;
    const force = Constants.CORNER_BLOWER_FORCE;
    const px = puck.pos.x;
    const py = puck.pos.y;
    
    if (px < cs && py < cs) { puck.velocity.x += force; puck.velocity.y += force; }
    else if (px > width - cs && py < cs) { puck.velocity.x -= force; puck.velocity.y += force; }
    else if (px < cs && py > height - cs) { puck.velocity.x += force; puck.velocity.y -= force; }
    else if (px > width - cs && py > height - cs) { puck.velocity.x -= force; puck.velocity.y -= force; }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const s = gameState.current;
    const { width, height, deadZoneTop, deadZoneBottom } = s.dimensions;

    // Clear
    ctx.fillStyle = Constants.TABLE_COLOR;
    ctx.fillRect(0, 0, width, height);

    // Dead Zone
    ctx.fillStyle = Constants.DEAD_ZONE_COLOR;
    ctx.fillRect(0, deadZoneTop, width, deadZoneBottom - deadZoneTop);

    // Lines
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeStyle = '#ef4444'; // Red center lines
    ctx.beginPath(); ctx.moveTo(0, deadZoneTop); ctx.lineTo(width, deadZoneTop); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, deadZoneBottom); ctx.lineTo(width, deadZoneBottom); ctx.stroke();
    ctx.setLineDash([]);

    // Corners
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 4;
    const cs = Constants.CORNER_BLOWER_SIZE;
    ctx.beginPath(); ctx.arc(0, 0, cs, 0, Math.PI/2); ctx.stroke();
    ctx.beginPath(); ctx.arc(width, 0, cs, Math.PI/2, Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(width, height, cs, Math.PI, 1.5*Math.PI); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, height, cs, 1.5*Math.PI, 0); ctx.stroke();

    // Center Circle
    ctx.strokeStyle = '#334155';
    ctx.beginPath(); ctx.arc(width/2, height/2, 40, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.arc(width/2, height/2, 4, 0, Math.PI*2); ctx.fillStyle='#334155'; ctx.fill();

    // Goals
    const goalW = width * Constants.GOAL_SIZE_RATIO;
    const goalX = (width - goalW) / 2;
    ctx.lineWidth = 8;
    ctx.shadowBlur = 10;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.strokeStyle = '#000';
    ctx.beginPath(); ctx.moveTo(goalX, 0); ctx.lineTo(goalX+goalW, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(goalX, height); ctx.lineTo(goalX+goalW, height); ctx.stroke();
    ctx.shadowBlur = 0;

    // Entities
    const drawEntity = (x: number, y: number, radius: number, color: string, glow: boolean = true) => {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        if (glow) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = color;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // inner detail
        ctx.beginPath();
        ctx.arc(x, y, radius * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.fill();
        
        // highlight
        ctx.beginPath();
        ctx.arc(x - radius*0.3, y - radius*0.3, radius * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fill();
    };

    drawEntity(s.p1.pos.x, s.p1.pos.y, Constants.PADDLE_RADIUS, Constants.P1_COLOR);
    drawEntity(s.p2.pos.x, s.p2.pos.y, Constants.PADDLE_RADIUS, Constants.P2_COLOR);
    drawEntity(s.puck.pos.x, s.puck.pos.y, Constants.PUCK_RADIUS, Constants.PUCK_COLOR, true);
  };

  const loop = () => {
    update();
    draw();
    requestRef.current = requestAnimationFrame(loop);
  };

  const startGame = (mode: GameMode, diff: Difficulty) => {
    gameState.current.p1.score = 0;
    gameState.current.p2.score = 0;
    gameState.current.mode = mode;
    gameState.current.difficulty = diff;
    gameState.current.timeLeft = Constants.GAME_DURATION_SEC;
    gameState.current.status = GameStatus.PLAYING;
    gameState.current.lastTick = Date.now();
    
    resetPositions();
    syncUi();
  };

  const endGame = () => {
    const s = gameState.current;
    s.status = GameStatus.GAME_OVER;
    
    let w = 'DRAW';
    if (s.p1.score > s.p2.score) {
        w = 'P1';
        // High score logic
        if (s.mode === GameMode.SINGLE_PLAYER) {
           const old = parseInt(localStorage.getItem('neonHockeyHighScore') || '0');
           if (s.p1.score > old) {
              localStorage.setItem('neonHockeyHighScore', s.p1.score.toString());
              setUiState(prev => ({ ...prev, highScore: s.p1.score }));
           }
        }
    } else if (s.p2.score > s.p1.score) {
        w = 'P2';
    }
    
    syncUi(w);
  };

  // --- Input Handling ---

  const handleInput = useCallback((e: TouchEvent | MouseEvent) => {
     // Explicitly prevent default to stop scrolling
     if (e.cancelable) {
        e.preventDefault();
     }

     const s = gameState.current;
     if (s.status !== GameStatus.PLAYING) return;
     
     // Normalize to array of points
     let points: {x: number, y: number}[] = [];
     
     if (window.TouchEvent && e instanceof TouchEvent) {
        for (let i = 0; i < e.touches.length; i++) {
           points.push({ x: e.touches[i].clientX, y: e.touches[i].clientY });
        }
     } else {
        // Mouse
        const me = e as MouseEvent;
        // Only track mouse move if button is down
        if (me.type === 'mousemove' && me.buttons !== 1) return;
        points.push({ x: me.clientX, y: me.clientY });
     }

     const { width, height, deadZoneTop, deadZoneBottom } = s.dimensions;
     const pr = Constants.PADDLE_RADIUS;

     points.forEach(pt => {
        // Simple heuristic: which side of screen is touch on?
        // In single player, user controls P1 (bottom)
        // In multiplayer, top half is P2, bottom half is P1
        
        if (s.mode === GameMode.SINGLE_PLAYER) {
           if (pt.y > height / 2) {
              s.p1.pos.x = pt.x;
              s.p1.pos.y = Math.min(Math.max(pt.y, deadZoneBottom + pr), height - pr);
           }
        } else {
           if (pt.y > height / 2) {
              s.p1.pos.x = pt.x;
              s.p1.pos.y = Math.min(Math.max(pt.y, deadZoneBottom + pr), height - pr);
           } else {
              s.p2.pos.x = pt.x;
              s.p2.pos.y = Math.min(Math.max(pt.y, pr), deadZoneTop - pr);
           }
        }
     });
     
     // Clamp X for all
     [s.p1, s.p2].forEach(p => {
        if (p.pos.x < pr) p.pos.x = pr;
        if (p.pos.x > width - pr) p.pos.x = width - pr;
     });
  }, []);

  // Pause Logic
  const togglePause = () => {
    const s = gameState.current;
    if (s.status === GameStatus.PLAYING) {
      s.status = GameStatus.PAUSED;
      syncUi();
    } else if (s.status === GameStatus.PAUSED) {
      s.status = GameStatus.PLAYING;
      s.lastTick = Date.now(); // Reset tick so we don't jump time
      syncUi();
    }
  };

  // Double tap center logic
  const lastTap = useRef(0);
  const handleCenterClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 400) {
      togglePause();
    }
    lastTap.current = now;
  };

  useEffect(() => {
    window.addEventListener('resize', resize);
    resize();
    requestRef.current = requestAnimationFrame(loop);
    
    // Bind native events for passive: false
    const canvas = canvasRef.current;
    
    // Global touch prevention to ensure no scrolling happens even if touch starts outside canvas
    const preventAll = (e: Event) => e.preventDefault();
    
    // Lock everything when component mounts
    document.body.addEventListener('touchmove', preventAll, { passive: false });
    // Prevent iOS zoom gestures
    // @ts-ignore - gesturestart is non-standard but vital for iOS
    document.addEventListener('gesturestart', preventAll, { passive: false });
    // @ts-ignore
    document.addEventListener('gesturechange', preventAll, { passive: false });

    if (canvas) {
        const onTouch = (e: TouchEvent) => handleInput(e);
        const onMouse = (e: MouseEvent) => handleInput(e);

        canvas.addEventListener('touchstart', onTouch, { passive: false });
        canvas.addEventListener('touchmove', onTouch, { passive: false });
        canvas.addEventListener('mousedown', onMouse);
        canvas.addEventListener('mousemove', onMouse);

        return () => {
            window.removeEventListener('resize', resize);
            if (requestRef.current) cancelAnimationFrame(requestRef.current);
            canvas.removeEventListener('touchstart', onTouch);
            canvas.removeEventListener('touchmove', onTouch);
            canvas.removeEventListener('mousedown', onMouse);
            canvas.removeEventListener('mousemove', onMouse);
            
            // Clean global locks
            document.body.removeEventListener('touchmove', preventAll);
            // @ts-ignore
            document.removeEventListener('gesturestart', preventAll);
            // @ts-ignore
            document.removeEventListener('gesturechange', preventAll);
        };
    }

    return () => {
        window.removeEventListener('resize', resize);
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
        document.body.removeEventListener('touchmove', preventAll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleInput]);

  // --- Formatted Time ---
  const min = Math.floor(uiState.timeLeft / 60);
  const sec = uiState.timeLeft % 60;
  const timeStr = `${min}:${sec < 10 ? '0' : ''}${sec}`;

  return (
    <div ref={containerRef} className="relative w-full h-full overflow-hidden select-none">
       {/* Background UI Layer (Score & Time) */}
       <div className="absolute inset-0 pointer-events-none flex flex-col justify-between z-10 py-8 px-4">
          {/* Top Score (P2) */}
          <div className="flex justify-center transform rotate-180">
             <span className="text-6xl font-black text-white/20">{uiState.scoreP2}</span>
          </div>
          
          {/* Center Info */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
             {uiState.mode === 'single' && uiState.status === GameStatus.PLAYING && (
               <div className="text-6xl font-mono font-bold text-white/10">{timeStr}</div>
             )}
             <div className="text-white/20 font-bold tracking-widest uppercase text-sm mt-2">
                {uiState.mode === 'single' ? DIFFICULTY_CONFIG[gameState.current.difficulty].label : ''}
             </div>
          </div>

          {/* Bottom Score (P1) */}
          <div className="flex justify-center">
             <span className="text-6xl font-black text-white/20">{uiState.scoreP1}</span>
          </div>
       </div>

       {/* Center Pause Button/Zone */}
       {uiState.status === GameStatus.PLAYING && (
         <button 
            onClick={handleCenterClick}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-white/10 bg-white/5 z-20 flex flex-col items-center justify-center gap-1 cursor-pointer active:bg-white/20 transition-colors"
         >
           <div className="w-6 h-0.5 bg-white/50 rounded"></div>
           <div className="w-6 h-0.5 bg-white/50 rounded"></div>
         </button>
       )}

       <GameMenu 
          status={uiState.status}
          scoreP1={uiState.scoreP1}
          scoreP2={uiState.scoreP2}
          timeLeft={uiState.timeLeft}
          highScore={uiState.highScore}
          winner={uiState.winner}
          gameMode={uiState.mode}
          onStartSingle={() => {
              gameState.current.status = GameStatus.DIFFICULTY_SELECT;
              syncUi();
          }}
          onStartMulti={() => startGame(GameMode.MULTI_PLAYER, Difficulty.MEDIUM)}
          onSelectDifficulty={(diff) => startGame(GameMode.SINGLE_PLAYER, diff)}
          onResume={() => togglePause()}
          onRestart={() => {
              gameState.current.status = GameStatus.MENU;
              syncUi();
          }}
          onQuit={() => {
             gameState.current.status = GameStatus.MENU;
             resetPositions();
             syncUi();
          }}
       />

       <canvas
          ref={canvasRef}
          className="block w-full h-full touch-none"
          style={{ touchAction: 'none' }}
       />
    </div>
  );
};