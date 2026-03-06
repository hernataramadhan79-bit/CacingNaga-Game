'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { MousePointer2, Zap, Trophy, Shield } from 'lucide-react';

interface JoinScreenProps {
  onJoin: (name: string, color: string) => void;
}

const COLORS = [
  { name: 'Emerald', value: '#10b981' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'Amber', value: '#f59e0b' },
  { name: 'Indigo', value: '#6366f1' },
];

export default function JoinScreen({ onJoin }: JoinScreenProps) {
  const [name, setName] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0].value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim(), selectedColor);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 flex flex-col items-center justify-center bg-zinc-950 z-50 overflow-hidden"
    >
      {/* Background Decorative Elements - More Immersive */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-cyan-500/10 blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
        
        {/* Subtle Grid Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-6 flex flex-col items-center">
        {/* Header Section - More Airy */}
        <div className="text-center mb-12">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter mb-4">
              <span className="text-transparent bg-clip-text bg-gradient-to-br from-emerald-400 via-emerald-500 to-cyan-600 drop-shadow-[0_0_20px_rgba(52,211,153,0.4)]">
                CACING
              </span>
              <span className="text-white ml-4 drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                NAGA
              </span>
            </h1>
            <p className="text-zinc-500 font-bold tracking-[0.3em] uppercase text-[10px] md:text-xs">
              Evolusi Ular Terkuat di Arena Global
            </p>
          </motion.div>
        </div>
        
        {/* Main Content Grid */}
        <div className="grid md:grid-cols-2 gap-12 w-full items-start">
          {/* Left: Form */}
          <motion.div
            initial={{ x: -30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="space-y-8 bg-zinc-900/30 backdrop-blur-md border border-white/5 p-8 rounded-[2rem]"
          >
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-end px-1">
                    <label htmlFor="nickname" className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">
                      Identitas Naga
                    </label>
                    <span className="text-[10px] text-zinc-600 font-mono">{name.length}/15</span>
                  </div>
                  <input
                    id="nickname"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nickname..."
                    maxLength={15}
                    className="w-full px-6 py-4 bg-black/40 border border-white/5 rounded-xl text-white placeholder-zinc-800 focus:outline-none focus:border-emerald-500/50 focus:ring-4 focus:ring-emerald-500/10 transition-all font-bold text-lg tracking-tight"
                    autoFocus
                    required
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] px-1">
                    Warna Naga
                  </label>
                  <div className="grid grid-cols-6 gap-2">
                    {COLORS.map((color) => (
                      <button
                        key={color.value}
                        type="button"
                        onClick={() => setSelectedColor(color.value)}
                        className={`aspect-square rounded-lg border-2 transition-all ${
                          selectedColor === color.value 
                            ? 'border-white scale-110 shadow-[0_0_15px_rgba(255,255,255,0.2)]' 
                            : 'border-transparent opacity-40 hover:opacity-100 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color.value }}
                        title={color.name}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!name.trim()}
                className="group relative w-full py-4 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 font-black rounded-xl transition-all shadow-lg hover:shadow-emerald-500/20 disabled:shadow-none text-lg uppercase tracking-widest overflow-hidden"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  Masuk Arena
                  <Zap className="w-5 h-5 fill-current" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
              </button>
            </form>
          </motion.div>

          {/* Right: Info & Instructions */}
          <motion.div
            initial={{ x: 30, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-1 gap-4">
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 flex items-start gap-4 transition-all hover:bg-white/[0.08]">
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <MousePointer2 className="w-6 h-6 text-emerald-400" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Navigasi</span>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">Gunakan Mouse atau Joystick untuk mengarahkan naga Anda di arena.</p>
                </div>
              </div>
              
              <div className="p-6 rounded-[2rem] bg-white/5 border border-white/5 flex items-start gap-4 transition-all hover:bg-white/[0.08]">
                <div className="p-3 rounded-xl bg-cyan-500/10">
                  <Zap className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block mb-1">Akselerasi</span>
                  <p className="text-xs text-zinc-500 leading-relaxed font-medium">Tahan Spasi atau tombol Boost untuk melesat lebih cepat.</p>
                </div>
              </div>
            </div>

            <div className="mt-auto pt-6 flex items-center justify-between px-2 border-t border-white/5">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-500/60" />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Global Ranking</span>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-blue-500/60" />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Anti-Cheat Active</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
