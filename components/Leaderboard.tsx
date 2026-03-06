'use client';

import { motion } from 'motion/react';

interface Player {
  id: string;
  name: string;
  score: number;
  color: string;
}

interface LeaderboardProps {
  players: Player[];
  currentPlayerId: string | null;
}

export default function Leaderboard({ players, currentPlayerId }: LeaderboardProps) {
  const topPlayers = [...players].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="fixed top-4 right-4 bg-zinc-950/80 backdrop-blur-md border border-zinc-800/50 p-4 rounded-2xl shadow-xl w-64 z-40"
    >
      <h2 className="text-zinc-400 text-xs font-bold uppercase tracking-wider mb-3">Papan Peringkat</h2>
      <div className="space-y-2">
        {topPlayers.map((player, index) => (
          <div 
            key={player.id} 
            className={`flex items-center justify-between text-sm ${player.id === currentPlayerId ? 'font-bold text-white' : 'text-zinc-300'}`}
          >
            <div className="flex items-center gap-2 truncate">
              <span className="text-zinc-500 w-4">{index + 1}.</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: player.color }} />
              <span className="truncate max-w-[100px]">{player.name}</span>
            </div>
            <span className="font-mono text-emerald-400">{Math.floor(player.score)}</span>
          </div>
        ))}
        {topPlayers.length === 0 && (
          <div className="text-zinc-500 text-sm italic">Tidak ada pemain online</div>
        )}
      </div>
    </motion.div>
  );
}
