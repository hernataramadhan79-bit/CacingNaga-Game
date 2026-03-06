'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import Leaderboard from './Leaderboard';
import JoinScreen from './JoinScreen';
import { motion } from 'motion/react';
import { soundManager } from '@/utils/sound';

interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  speedMultiplier?: number;
  score: number;
  segments: { x: number; y: number }[];
  color: string;
  paused?: boolean;
  boosting?: boolean;
}

interface Food {
  id: string;
  x: number;
  y: number;
  color: string;
  value: number;
}

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const [gameState, setGameState] = useState<{
    players: Record<string, Player>;
    foods: Record<string, Food>;
    me: string | null;
    gameWidth: number;
    gameHeight: number;
  }>({
    players: {},
    foods: {},
    me: null,
    gameWidth: 3000,
    gameHeight: 3000,
  });

  const [joined, setJoined] = useState(false);
  const [dead, setDead] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
  const [joystick, setJoystick] = useState<{ active: boolean, x: number, y: number, curX: number, curY: number } | null>(null);
  const joystickRef = useRef<{ active: boolean, x: number, y: number, curX: number, curY: number } | null>(null);

  // Refs for animation loop
  const stateRef = useRef(gameState);

  useEffect(() => {
    stateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    joystickRef.current = joystick;
  }, [joystick]);

  const zoomRef = useRef(1);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Connect to Socket.io
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    const newSocket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = newSocket;

    newSocket.on('init', (data) => {
      setGameState(prev => ({
        ...prev,
        me: data.id,
        players: data.players,
        foods: data.foods,
        gameWidth: data.GAME_WIDTH,
        gameHeight: data.GAME_HEIGHT,
      }));
    });

    newSocket.on('playerJoined', (player: Player) => {
      setGameState(prev => ({
        ...prev,
        players: { ...prev.players, [player.id]: player }
      }));
    });

    newSocket.on('playerLeft', (id: string) => {
      setGameState(prev => {
        const newPlayers = { ...prev.players };
        delete newPlayers[id];
        return { ...prev, players: newPlayers };
      });
    });

    newSocket.on('stateUpdate', (updates: Record<string, Partial<Player>>) => {
      setGameState(prev => {
        const newPlayers = { ...prev.players };
        const myId = prev.me;

        Object.keys(updates).forEach(id => {
          if (newPlayers[id]) {
            // Play eat sound if my score increased
            if (id === myId && updates[id].score && updates[id].score! > newPlayers[id].score) {
              soundManager.playEat();
            }

            // Handle boost sound start/stop
            if (id === myId && updates[id].boosting !== undefined) {
              if (updates[id].boosting && !newPlayers[id].boosting) {
                soundManager.startBoost();
              } else if (!updates[id].boosting && newPlayers[id].boosting) {
                soundManager.stopBoost();
              }
            }

            newPlayers[id] = { ...newPlayers[id], ...updates[id] };
          }
        });
        return { ...prev, players: newPlayers };
      });
    });

    newSocket.on('foodSpawned', (food: Food) => {
      setGameState(prev => ({
        ...prev,
        foods: { ...prev.foods, [food.id]: food }
      }));
    });

    newSocket.on('foodsEaten', (foodIds: string[]) => {
      setGameState(prev => {
        const newFoods = { ...prev.foods };
        foodIds.forEach(id => delete newFoods[id]);
        return { ...prev, foods: newFoods };
      });
    });

    newSocket.on('foodsMoved', (movedFoods: Record<string, { x: number, y: number }>) => {
      setGameState(prev => {
        const newFoods = { ...prev.foods };
        Object.entries(movedFoods).forEach(([id, pos]) => {
          if (newFoods[id]) {
            newFoods[id] = { ...newFoods[id], x: pos.x, y: pos.y };
          }
        });
        return { ...prev, foods: newFoods };
      });
    });

    newSocket.on('died', () => {
      soundManager.playDeath();
      soundManager.stopBoost();
      setDead(true);
      setJoined(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Input handling
  useEffect(() => {
    const socket = socketRef.current;
    if (!joined || !socket) return;

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        socket.emit('boostStart');
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        socket.emit('boostEnd');
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const inputInterval = setInterval(() => {
      const state = stateRef.current;
      if (!state.me || !state.players[state.me]) return;

      const me = state.players[state.me];
      const canvas = canvasRef.current;
      if (!canvas) return;

      const currentJoystick = joystickRef.current;
      if (currentJoystick && currentJoystick.active) {
        const dx = currentJoystick.curX - currentJoystick.x;
        const dy = currentJoystick.curY - currentJoystick.y;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          const angle = Math.atan2(dy, dx);
          socket.emit('input', angle);
        }
      } else if (!isMobile) {
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;

        // Adjust mouse input for zoom
        const zoom = zoomRef.current;
        const dx = (mouseRef.current.x - centerX) / zoom;
        const dy = (mouseRef.current.y - centerY) / zoom;

        const angle = Math.atan2(dy, dx);
        socket.emit('input', angle);
      }
    }, 1000 / 30); // Send input at 30fps

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      clearInterval(inputInterval);
    };
  }, [joined, isMobile]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      const state = stateRef.current;

      try {
        // Handle resize
        if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
          canvas.width = window.innerWidth;
          canvas.height = window.innerHeight;
        }

        // Reset transform to identity and clear
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = '#0a0a0a'; // zinc-950
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        let cameraX = state.gameWidth / 2;
        let cameraY = state.gameHeight / 2;
        let targetZoom = 1;

        if (state.me && state.players[state.me]) {
          const me = state.players[state.me];
          cameraX = me.x;
          cameraY = me.y;

          // Calculate target zoom based on score
          targetZoom = 1 / (1 + me.score / 1500);
          if (targetZoom < 0.3) targetZoom = 0.3; // Min zoom limit
        }

        // Smooth zoom interpolation
        zoomRef.current += (targetZoom - zoomRef.current) * 0.05;
        const zoom = zoomRef.current;

        ctx.save();
        // Center camera with zoom
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-cameraX, -cameraY);

        // Draw grid
        ctx.strokeStyle = '#18181b'; // zinc-900
        ctx.lineWidth = 2 / zoom; // Keep grid lines consistent thickness
        const gridSize = 100;

        // Adjust visible bounds for zoom
        const visibleWidth = canvas.width / zoom;
        const visibleHeight = canvas.height / zoom;

        const startX = Math.floor((cameraX - visibleWidth / 2) / gridSize) * gridSize;
        const startY = Math.floor((cameraY - visibleHeight / 2) / gridSize) * gridSize;
        const endX = startX + visibleWidth + gridSize;
        const endY = startY + visibleHeight + gridSize;

        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
          ctx.moveTo(x, startY);
          ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
        }
        ctx.stroke();

        // Draw bounds
        ctx.strokeStyle = '#ef4444'; // red-500
        ctx.lineWidth = 5 / zoom;
        ctx.strokeRect(0, 0, state.gameWidth, state.gameHeight);

        // Draw foods
        Object.values(state.foods).forEach(food => {
          // Simple check if food is being pulled by any player (for visual effect)
          let isBeingPulled = false;
          const magnetRadiusSq = 65 * 65;

          for (const pId in state.players) {
            const p = state.players[pId];
            const dx = p.x - food.x;
            const dy = p.y - food.y;
            if (dx * dx + dy * dy < magnetRadiusSq) {
              isBeingPulled = true;
              break;
            }
          }

          const baseRadius = 5 + food.value;

          if (isBeingPulled) {
            // Manual glow instead of shadowBlur
            const pulse = Math.sin(Date.now() / 100) * 2;
            const glowRadius = (baseRadius + 10 + pulse);

            ctx.beginPath();
            ctx.arc(food.x, food.y, glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();

            ctx.beginPath();
            ctx.arc(food.x, food.y, baseRadius + pulse, 0, Math.PI * 2);
            ctx.fillStyle = food.color;
            ctx.fill();
          } else {
            // Simple glow
            ctx.beginPath();
            ctx.arc(food.x, food.y, baseRadius + 4, 0, Math.PI * 2);
            ctx.fillStyle = food.color;
            ctx.globalAlpha = 0.2;
            ctx.fill();
            ctx.globalAlpha = 1.0;

            ctx.beginPath();
            ctx.arc(food.x, food.y, baseRadius, 0, Math.PI * 2);
            ctx.fillStyle = food.color;
            ctx.fill();
          }
        });

        // Draw players
        Object.values(state.players).forEach(player => {
          const isMe = player.id === state.me;

          ctx.save();
          if (player.paused) {
            ctx.globalAlpha = 0.5;
          }

          // Draw segments
          for (let i = player.segments.length - 1; i >= 0; i--) {
            const seg = player.segments[i];

            // Draw Aura Effect when boosting
            if (player.boosting && player.speedMultiplier && player.speedMultiplier > 1.02) {
              const auraIntensity = Math.min(1, (player.speedMultiplier - 1) * 3);
              const time = Date.now() / 60;

              ctx.save();
              ctx.globalCompositeOperation = 'screen';

              // Calculate distance from head for tapering effect
              const distFromHead = i / player.segments.length;
              const taper = 1 - (distFromHead * 0.6); // Aura is 100% at head, 40% at tail

              // Turbulent aura layers
              const layers = 4; // Increased layers
              for (let j = 0; j < layers; j++) {
                // Flowing effect: waves move from head to tail with multiple frequencies
                const waveOffset = (i * 0.5) - (time * (5 + j));
                const pulse = (Math.sin(waveOffset) + Math.cos(waveOffset * 1.3) + Math.sin(waveOffset * 0.7)) * 6;

                const size = (25 + pulse + (j * 15)) * taper;
                const opacity = (1.0 / layers) * auraIntensity * taper;

                // Turbulent noise with chromatic-like offset
                const noiseX = Math.cos(waveOffset * 1.8 + j) * (10 + j * 2);
                const noiseY = Math.sin(waveOffset * 1.8 + j) * (10 + j * 2);

                ctx.beginPath();
                ctx.arc(seg.x + noiseX, seg.y + noiseY, size, 0, Math.PI * 2);

                // Shift color slightly for each layer for a "rainbow/heat" effect
                if (j % 2 === 0) {
                  ctx.fillStyle = player.color;
                } else {
                  // Brighter version of player color
                  ctx.fillStyle = '#fff';
                }

                ctx.globalAlpha = opacity * 0.7;
                ctx.fill();

                // Speed streaks
                if (i % 3 === 0 && j === 0 && Math.random() > 0.7) {
                  const streakLen = 40 + Math.random() * 60;
                  const streakAngle = player.angle + Math.PI + (Math.random() - 0.5) * 0.5;
                  ctx.beginPath();
                  ctx.moveTo(seg.x, seg.y);
                  ctx.lineTo(
                    seg.x + Math.cos(streakAngle) * streakLen,
                    seg.y + Math.sin(streakAngle) * streakLen
                  );
                  ctx.strokeStyle = '#fff';
                  ctx.lineWidth = 2;
                  ctx.globalAlpha = 0.3 * auraIntensity;
                  ctx.stroke();
                }

                // Energy sparks (randomly appearing)
                if (Math.random() > 0.92) {
                  const sparkX = seg.x + (Math.random() - 0.5) * 50;
                  const sparkY = seg.y + (Math.random() - 0.5) * 50;
                  ctx.beginPath();
                  ctx.arc(sparkX, sparkY, 2.5, 0, Math.PI * 2);
                  ctx.fillStyle = '#fff';
                  ctx.globalAlpha = auraIntensity;
                  ctx.fill();
                }

                // Inner core
                if (j === 0) {
                  ctx.beginPath();
                  ctx.arc(seg.x + noiseX, seg.y + noiseY, size * 0.35, 0, Math.PI * 2);
                  ctx.fillStyle = '#ffffff';
                  ctx.globalAlpha = opacity * 1.0;
                  ctx.fill();
                }
              }
              ctx.restore();
            }

            ctx.beginPath();
            ctx.arc(seg.x, seg.y, 12, 0, Math.PI * 2);
            ctx.fillStyle = player.color;
            ctx.fill();

            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2 / zoom;
            ctx.stroke();
          }

          // Draw head
          // Head Aura - Massive flare with "shockwave" and "start flash"
          if (player.boosting && player.speedMultiplier && player.speedMultiplier > 1.02) {
            const auraIntensity = Math.min(1, (player.speedMultiplier - 1) * 3);
            const time = Date.now() / 30;

            ctx.save();
            ctx.globalCompositeOperation = 'screen';

            // Boost Start Flash: Large bright circle that fades as speed stabilizes
            const flashIntensity = Math.max(0, 1 - (player.speedMultiplier - 1) * 2);
            if (flashIntensity > 0) {
              ctx.beginPath();
              ctx.arc(player.x, player.y, 120 * flashIntensity, 0, Math.PI * 2);
              ctx.fillStyle = '#fff';
              ctx.globalAlpha = flashIntensity * 0.5;
              ctx.fill();
            }

            // Shockwave rings
            for (let k = 0; k < 3; k++) { // Increased rings
              const ringTime = (time * 0.08 + k * 0.33) % 1;
              const ringSize = 25 + ringTime * 120;
              ctx.beginPath();
              ctx.arc(player.x, player.y, ringSize, 0, Math.PI * 2);
              ctx.strokeStyle = player.color;
              ctx.lineWidth = 6 * (1 - ringTime);
              ctx.globalAlpha = (0.5 * (1 - ringTime)) * auraIntensity;
              ctx.stroke();
            }

            // Trailing energy streaks from head
            for (let m = 0; m < 8; m++) {
              const streakAngle = player.angle + Math.PI + (Math.random() - 0.5) * 0.8;
              const streakLen = 60 + Math.random() * 100 * auraIntensity;
              ctx.beginPath();
              ctx.moveTo(player.x, player.y);
              ctx.lineTo(
                player.x + Math.cos(streakAngle) * streakLen,
                player.y + Math.sin(streakAngle) * streakLen
              );
              ctx.strokeStyle = '#fff';
              ctx.lineWidth = 3;
              ctx.globalAlpha = 0.4 * auraIntensity * (1 - m / 8);
              ctx.stroke();
            }

            for (let j = 0; j < 6; j++) { // Increased layers
              const pulse = Math.sin(time + j) * 22;
              const size = 45 + (j * 18) + pulse;

              const trailX = Math.cos(player.angle) * -j * 12;
              const trailY = Math.sin(player.angle) * -j * 12;

              const forwardX = Math.cos(player.angle) * 20;
              const forwardY = Math.sin(player.angle) * 20;

              ctx.beginPath();
              ctx.arc(player.x + trailX + forwardX, player.y + trailY + forwardY, size, 0, Math.PI * 2);

              if (j % 2 === 0) {
                ctx.fillStyle = player.color;
              } else {
                ctx.fillStyle = '#fff';
              }

              ctx.globalAlpha = (0.6 - j * 0.1) * auraIntensity;
              ctx.fill();

              if (j < 3) {
                ctx.beginPath();
                ctx.arc(player.x + trailX + forwardX, player.y + trailY + forwardY, size * 0.4, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.globalAlpha = 0.8 * auraIntensity;
                ctx.fill();
              }
            }
            ctx.restore();
          }

          ctx.beginPath();
          ctx.arc(player.x, player.y, 15, 0, Math.PI * 2);
          ctx.fillStyle = player.color;
          ctx.fill();

          if (player.boosting) {
            ctx.shadowBlur = 20 / zoom;
            ctx.shadowColor = '#fff';
          }

          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2 / zoom;
          ctx.stroke();
          ctx.shadowBlur = 0;

          // Draw eyes
          const eyeOffset = 8;
          const eyeRadius = 4;
          const angle = player.angle || 0;

          ctx.save();
          ctx.translate(player.x, player.y);
          ctx.rotate(angle);

          // Left eye
          ctx.beginPath();
          ctx.arc(eyeOffset, -eyeOffset, eyeRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(eyeOffset + 1, -eyeOffset, eyeRadius / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#000';
          ctx.fill();

          // Right eye
          ctx.beginPath();
          ctx.arc(eyeOffset, eyeOffset, eyeRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(eyeOffset + 1, eyeOffset, eyeRadius / 2, 0, Math.PI * 2);
          ctx.fillStyle = '#000';
          ctx.fill();

          ctx.restore();

          // Draw name
          ctx.fillStyle = '#fff';
          const fontSize = 14 / zoom;
          ctx.font = `${fontSize}px Inter, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(player.name + (player.paused ? ' (Dijeda)' : ''), player.x, player.y - (25 / zoom));

          ctx.restore();
        });

      } finally {
        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleJoin = (name: string, color: string) => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('join', name, color);
      setJoined(true);
      setDead(false);
    }
  };

  const handlePause = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('pause');
      setShowSettings(true);
    }
  };

  const handleResume = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('resume');
      setShowSettings(false);
    }
  };

  const handleLeave = () => {
    const socket = socketRef.current;
    if (socket) {
      socket.emit('leave');
      soundManager.stopBoost();
      setJoined(false);
      setShowSettings(false);
      setDead(false);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (!joined || showSettings || dead) return;
    const touch = e.touches[0];
    setJoystick({
      active: true,
      x: touch.clientX,
      y: touch.clientY,
      curX: touch.clientX,
      curY: touch.clientY
    });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!joystick) return;
    const touch = e.touches[0];
    setJoystick({
      ...joystick,
      curX: touch.clientX,
      curY: touch.clientY
    });
  };

  const handleTouchEnd = () => {
    setJoystick(null);
  };

  return (
    <div
      className="relative w-full h-screen overflow-hidden bg-zinc-950 touch-none"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
      />

      {!joined && !dead && (
        <JoinScreen onJoin={handleJoin} />
      )}

      {dead && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-50"
        >
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
            <h1 className="text-4xl font-black text-red-500 mb-4 tracking-tighter">ANDA MATI!</h1>
            <p className="text-zinc-400 mb-8">Semoga beruntung di permainan berikutnya.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => setDead(false)}
                className="w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] text-lg"
              >
                Main Lagi
              </button>
              <button
                onClick={handleLeave}
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all"
              >
                Keluar ke Beranda
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {showSettings && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="fixed inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm z-50"
        >
          <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl shadow-2xl max-w-md w-full text-center">
            <h1 className="text-3xl font-bold text-white mb-4">Permainan Dijeda</h1>
            <p className="text-zinc-400 mb-8">Ular Anda saat ini tidak dapat bergerak tetapi masih bisa mati jika ditabrak.</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleResume}
                className="w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] text-lg"
              >
                Lanjutkan Bermain
              </button>
              <button
                onClick={handleLeave}
                className="w-full py-3 px-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold rounded-xl transition-all"
              >
                Keluar ke Beranda
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {joystick && (
        <div
          className="fixed pointer-events-none z-30"
          style={{ left: joystick.x - 50, top: joystick.y - 50 }}
        >
          <div className="w-[100px] h-[100px] rounded-full border-2 border-white/20 bg-white/5 flex items-center justify-center">
            <div
              className="w-10 h-10 rounded-full bg-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.5)]"
              style={{
                transform: `translate(${Math.max(-40, Math.min(40, joystick.curX - joystick.x))}px, ${Math.max(-40, Math.min(40, joystick.curY - joystick.y))}px)`
              }}
            />
          </div>
        </div>
      )}

      {isMobile && joined && !showSettings && (
        <button
          onPointerDown={() => socketRef.current?.emit('boostStart')}
          onPointerUp={() => socketRef.current?.emit('boostEnd')}
          className="fixed bottom-8 right-8 w-20 h-20 bg-emerald-500/20 border-2 border-emerald-500/50 rounded-full flex items-center justify-center z-40 active:bg-emerald-500/40 transition-all select-none"
        >
          <div className="text-emerald-400 font-black text-xs uppercase tracking-tighter">BOOST</div>
        </button>
      )}

      {joined && !showSettings && (
        <Leaderboard
          players={Object.values(gameState.players)}
          currentPlayerId={gameState.me}
        />
      )}

      {joined && !showSettings && gameState.me && gameState.players[gameState.me] && (
        <>
          <div className="fixed bottom-4 left-4 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/50 p-4 rounded-2xl shadow-xl z-40">
            <div className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-1">Skor Anda</div>
            <div className="text-3xl font-mono font-bold text-emerald-400">
              {Math.floor(gameState.players[gameState.me].score)}
            </div>
          </div>

          <button
            onClick={handlePause}
            className="fixed top-4 left-4 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/50 p-3 rounded-2xl shadow-xl z-40 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="6" y="4" width="4" height="16"></rect>
              <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            <span className="sr-only">Pause</span>
          </button>
        </>
      )}
    </div>
  );
}
