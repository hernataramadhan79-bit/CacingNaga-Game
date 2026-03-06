export class SoundManager {
  private ctx: AudioContext | null = null;
  private boostOscillator: OscillatorNode | null = null;
  private boostGain: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  private initCtx() {
    if (this.ctx?.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playEat() {
    if (!this.ctx) return;
    this.initCtx();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(400, this.ctx.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.1);
  }

  playDeath() {
    if (!this.ctx) return;
    this.initCtx();
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, this.ctx.currentTime + 0.5);
    
    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
    
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    
    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  startBoost() {
    if (!this.ctx || this.boostOscillator) return;
    this.initCtx();
    
    this.boostOscillator = this.ctx.createOscillator();
    this.boostGain = this.ctx.createGain();
    
    this.boostOscillator.type = 'triangle';
    this.boostOscillator.frequency.setValueAtTime(100, this.ctx.currentTime);
    
    this.boostGain.gain.setValueAtTime(0, this.ctx.currentTime);
    this.boostGain.gain.linearRampToValueAtTime(0.05, this.ctx.currentTime + 0.1);
    
    this.boostOscillator.connect(this.boostGain);
    this.boostGain.connect(this.ctx.destination);
    
    this.boostOscillator.start();
  }

  stopBoost() {
    if (!this.ctx || !this.boostOscillator || !this.boostGain) return;
    
    const currentOsc = this.boostOscillator;
    const currentGain = this.boostGain;
    
    currentGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.1);
    currentOsc.stop(this.ctx.currentTime + 0.1);
    
    this.boostOscillator = null;
    this.boostGain = null;
  }
}

export const soundManager = new SoundManager();
