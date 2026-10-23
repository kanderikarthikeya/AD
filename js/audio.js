/**
 * Web Audio API Sound Synthesizer for UI & Mocap Events
 */
class SoundEffects {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.08) {
    if (this.muted) return;
    try {
      this.init();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      // Audio might be blocked until user gesture, safely ignore
    }
  }

  click() {
    this.playTone(800, 'triangle', 0.05, 0.04);
  }

  startCapture() {
    this.playTone(440, 'sine', 0.1, 0.06);
    setTimeout(() => this.playTone(880, 'sine', 0.15, 0.08), 80);
  }

  stopCapture() {
    this.playTone(660, 'sine', 0.1, 0.06);
    setTimeout(() => this.playTone(330, 'sine', 0.15, 0.07), 80);
  }

  recordStart() {
    this.playTone(523.25, 'sawtooth', 0.08, 0.05); // C5
    setTimeout(() => this.playTone(659.25, 'sawtooth', 0.08, 0.05), 80); // E5
    setTimeout(() => this.playTone(783.99, 'sawtooth', 0.18, 0.07), 160); // G5
  }

  recordStop() {
    this.playTone(783.99, 'sine', 0.08, 0.06);
    setTimeout(() => this.playTone(523.25, 'sine', 0.15, 0.06), 90);
  }

  error() {
    this.playTone(220, 'square', 0.25, 0.08);
  }
}

window.soundFx = new SoundEffects();
