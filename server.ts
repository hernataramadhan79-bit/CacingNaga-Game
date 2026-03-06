import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import next from 'next';
import { parse } from 'url';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const PORT = process.env.PORT || 3000;

// Game State
interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  angle: number;
  targetAngle: number;
  speedMultiplier: number;
  score: number;
  segments: { x: number; y: number }[];
  color: string;
  lastUpdate: number;
  paused: boolean;
  boosting: boolean;
}

interface Food {
  id: string;
  x: number;
  y: number;
  color: string;
  value: number;
}

const GAME_WIDTH = 3000;
const GAME_HEIGHT = 3000;
const BASE_SPEED = 200; // pixels per second
const TURN_SPEED = 5; // radians per second
const SEGMENT_DISTANCE = 10;
const FOOD_COUNT = 200;
const MAGNET_RADIUS = 65;
const MAGNET_PULL_SPEED = 600; // pixels per second

const players: Record<string, Player> = {};
const foods: Record<string, Food> = {};

const colors = [
  '#FF3366', '#33CCFF', '#66FF33', '#FFCC00', '#CC33FF', '#FF9933', '#00FFCC'
];

function randomColor() {
  return colors[Math.floor(Math.random() * colors.length)];
}

function spawnFood(id?: string) {
  const foodId = id || `food_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
  foods[foodId] = {
    id: foodId,
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT,
    color: randomColor(),
    value: Math.floor(Math.random() * 5) + 1,
  };
  return foods[foodId];
}

// Initialize food
for (let i = 0; i < FOOD_COUNT; i++) {
  spawnFood();
}

app.prepare().then(() => {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    },
  });

  io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join', (name: string, color?: string) => {
      players[socket.id] = {
        id: socket.id,
        name: name.slice(0, 15) || 'Anonymous',
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        angle: Math.random() * Math.PI * 2,
        targetAngle: 0,
        speedMultiplier: 1.0,
        score: 10,
        segments: [],
        color: color || randomColor(),
        lastUpdate: Date.now(),
        paused: false,
        boosting: false,
      };
      players[socket.id].targetAngle = players[socket.id].angle;
      
      // Initialize segments
      for(let i=0; i<5; i++) {
        players[socket.id].segments.push({
          x: players[socket.id].x,
          y: players[socket.id].y
        });
      }

      socket.emit('init', {
        id: socket.id,
        players,
        foods,
        GAME_WIDTH,
        GAME_HEIGHT
      });
      
      io.emit('playerJoined', players[socket.id]);
    });

    socket.on('input', (angle: number) => {
      if (players[socket.id] && !players[socket.id].paused) {
        players[socket.id].targetAngle = angle;
      }
    });

    socket.on('boostStart', () => {
      if (players[socket.id] && players[socket.id].score > 15) {
        players[socket.id].boosting = true;
      }
    });

    socket.on('boostEnd', () => {
      if (players[socket.id]) {
        players[socket.id].boosting = false;
      }
    });

    socket.on('leave', () => {
      if (players[socket.id]) {
        const p = players[socket.id];
        p.segments.forEach((seg, i) => {
          if (i % 2 === 0) {
            const foodId = `drop_${socket.id}_${i}_${Date.now()}`;
            foods[foodId] = {
              id: foodId,
              x: seg.x,
              y: seg.y,
              color: p.color,
              value: 3
            };
            io.emit('foodSpawned', foods[foodId]);
          }
        });
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
      }
    });

    socket.on('pause', () => {
      if (players[socket.id]) {
        players[socket.id].paused = true;
      }
    });

    socket.on('resume', () => {
      if (players[socket.id]) {
        players[socket.id].paused = false;
      }
    });

    socket.on('disconnect', () => {
      console.log('Player disconnected:', socket.id);
      if (players[socket.id]) {
        // Turn player into food
        const p = players[socket.id];
        p.segments.forEach((seg, i) => {
          if (i % 2 === 0) {
            const foodId = `drop_${socket.id}_${i}`;
            foods[foodId] = {
              id: foodId,
              x: seg.x,
              y: seg.y,
              color: p.color,
              value: 3
            };
            io.emit('foodSpawned', foods[foodId]);
          }
        });
        
        delete players[socket.id];
        io.emit('playerLeft', socket.id);
      }
    });
  });

  // Game Loop
  let lastTime = Date.now();
  setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const updates: Record<string, { x: number, y: number, angle: number, segments: {x:number, y:number}[], score: number, paused?: boolean, boosting?: boolean }> = {};
    const deadPlayers: string[] = [];
    const eatenFoods: string[] = [];
    const movedFoods: Record<string, { x: number, y: number }> = {};

    // Update positions
    Object.values(players).forEach(p => {
      if (p.paused) {
        updates[p.id] = {
          x: p.x,
          y: p.y,
          angle: p.angle,
          segments: p.segments,
          score: p.score,
          paused: p.paused,
          boosting: p.boosting
        };
        return;
      }

      // Smooth acceleration for boost
      const targetMultiplier = (p.boosting && p.score > 10) ? 1.8 : 1.0;
      const accelRate = p.boosting ? 4.0 : 2.0; // Faster acceleration, slower deceleration
      if (p.speedMultiplier < targetMultiplier) {
        p.speedMultiplier = Math.min(targetMultiplier, p.speedMultiplier + accelRate * dt);
      } else if (p.speedMultiplier > targetMultiplier) {
        p.speedMultiplier = Math.max(targetMultiplier, p.speedMultiplier - accelRate * dt);
      }

      let speed = (BASE_SPEED + (p.score / 100)) * p.speedMultiplier;
      
      if (p.boosting) {
        if (p.score > 10) {
          p.score -= 5 * dt; // Consume 5 score per second
          
          // Drop food occasionally while boosting
          if (Math.random() < 0.1) {
            const foodId = `boost_drop_${p.id}_${Date.now()}`;
            foods[foodId] = {
              id: foodId,
              x: p.segments[p.segments.length - 1].x,
              y: p.segments[p.segments.length - 1].y,
              color: p.color,
              value: 1
            };
            io.emit('foodSpawned', foods[foodId]);
          }
        } else {
          p.boosting = false;
        }
      }

      // Smoothly rotate towards target angle
      let angleDiff = p.targetAngle - p.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      const maxTurn = TURN_SPEED * dt;
      if (Math.abs(angleDiff) > maxTurn) {
        p.angle += Math.sign(angleDiff) * maxTurn;
      } else {
        p.angle = p.targetAngle;
      }
      
      // Move head
      p.x += Math.cos(p.angle) * speed * dt;
      p.y += Math.sin(p.angle) * speed * dt;

      // Clamp to bounds
      p.x = Math.max(0, Math.min(GAME_WIDTH, p.x));
      p.y = Math.max(0, Math.min(GAME_HEIGHT, p.y));

      // Update segments
      let prevX = p.x;
      let prevY = p.y;
      
      for (let i = 0; i < p.segments.length; i++) {
        const seg = p.segments[i];
        const dx = prevX - seg.x;
        const dy = prevY - seg.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > SEGMENT_DISTANCE) {
          const moveRatio = (dist - SEGMENT_DISTANCE) / dist;
          seg.x += dx * moveRatio;
          seg.y += dy * moveRatio;
        }
        
        prevX = seg.x;
        prevY = seg.y;
      }

      // Check food collisions and magnet effect
      Object.values(foods).forEach(f => {
        const dx = p.x - f.x;
        const dy = p.y - f.y;
        const distSq = dx * dx + dy * dy;

        // Magnet effect: pull food towards head
        if (distSq < MAGNET_RADIUS * MAGNET_RADIUS) {
          const dist = Math.sqrt(distSq);
          if (dist > 0) {
            const pullDist = MAGNET_PULL_SPEED * dt;
            // Move food towards player head
            f.x += (dx / dist) * pullDist;
            f.y += (dy / dist) * pullDist;
            movedFoods[f.id] = { x: f.x, y: f.y };
          }
        }

        // Re-calculate distance after pull for collision
        const newDx = p.x - f.x;
        const newDy = p.y - f.y;
        const newDistSq = newDx * newDx + newDy * newDy;

        if (newDistSq < 625) { // 25px radius (increased from 20px)
          p.score += f.value;
          
          // Add segment every 5 score
          const targetSegments = Math.floor(p.score / 5) + 5;
          while(p.segments.length < targetSegments) {
            p.segments.push({...p.segments[p.segments.length - 1]});
          }
          
          eatenFoods.push(f.id);
          delete foods[f.id];
          delete movedFoods[f.id];
          
          // Respawn food if it was a natural one
          if (f.id.startsWith('food_')) {
            const newFood = spawnFood();
            io.emit('foodSpawned', newFood);
          }
        }
      });

      updates[p.id] = {
        x: p.x,
        y: p.y,
        angle: p.angle,
        segments: p.segments,
        score: p.score,
        paused: p.paused,
        boosting: p.boosting
      };
    });

    // Check player collisions (head to body)
    const playerArr = Object.values(players);
    for (let i = 0; i < playerArr.length; i++) {
      const p1 = playerArr[i];
      for (let j = 0; j < playerArr.length; j++) {
        if (i === j) continue;
        const p2 = playerArr[j];
        
        // Check if p1 head hits p2 segments
        for (let k = 0; k < p2.segments.length; k++) {
          const seg = p2.segments[k];
          const dx = p1.x - seg.x;
          const dy = p1.y - seg.y;
          // Head radius ~15, segment radius ~10 -> 25^2 = 625
          if (dx * dx + dy * dy < 625) {
            if (!deadPlayers.includes(p1.id)) {
              deadPlayers.push(p1.id);
            }
            break;
          }
        }
      }
    }

    // Handle deaths
    deadPlayers.forEach(id => {
      const p = players[id];
      if (p) {
        // Drop food
        p.segments.forEach((seg, i) => {
          if (i % 2 === 0) {
            const foodId = `drop_${id}_${i}_${Date.now()}`;
            foods[foodId] = {
              id: foodId,
              x: seg.x,
              y: seg.y,
              color: p.color,
              value: 3
            };
            io.emit('foodSpawned', foods[foodId]);
          }
        });
        
        io.to(id).emit('died');
        io.emit('playerLeft', id);
        delete players[id];
        delete updates[id];
      }
    });

    if (eatenFoods.length > 0) {
      io.emit('foodsEaten', eatenFoods);
    }

    if (Object.keys(movedFoods).length > 0) {
      io.emit('foodsMoved', movedFoods);
    }

    if (Object.keys(updates).length > 0) {
      io.emit('stateUpdate', updates);
    }

  }, 1000 / 30); // 30 FPS

  server.all(/.*/, (req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  httpServer.listen(PORT, () => {
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
