/**
 * Web Audio Fallback Synthesizer for "Humnava Mere"
 * Guarantees 100% offline acoustic playback on any Android WebView or browser
 */

class HumnavaSynthesizer {
  private ctx: AudioContext | null = null;
  private isPlaying = false;
  private currentStep = 0;
  private intervalId: number | null = null;
  private tempo = 72; // BPM
  private onTimeUpdateCallback: ((time: number, duration: number) => void) | null = null;
  private onEndedCallback: (() => void) | null = null;
  private totalDuration = 49;
  private startTime = 0;

  private notes: Record<string, number> = {
    'B2': 123.47, 'D3': 146.83, 'F#3': 185.00, 'G2': 98.00, 'A2': 110.00,
    'B3': 246.94, 'C#4': 277.18, 'D4': 293.66, 'E4': 329.63, 'F#4': 369.99,
    'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C#5': 554.37, 'D5': 587.33
  };

  private melody = [
    { note: 'B3', time: 0.0, dur: 1.4 },
    { note: 'D4', time: 0.4, dur: 1.4 },
    { note: 'F#4', time: 0.8, dur: 1.5 },
    { note: 'B4', time: 1.2, dur: 2.0 },
    { note: 'G3', time: 2.6, dur: 1.4 },
    { note: 'B3', time: 3.0, dur: 1.4 },
    { note: 'D4', time: 3.4, dur: 1.5 },
    { note: 'G4', time: 3.8, dur: 2.0 },
    { note: 'A3', time: 5.2, dur: 1.4 },
    { note: 'C#4', time: 5.6, dur: 1.4 },
    { note: 'E4', time: 6.0, dur: 1.5 },
    { note: 'A4', time: 6.4, dur: 2.0 },
    { note: 'F#3', time: 7.8, dur: 1.4 },
    { note: 'A3', time: 8.2, dur: 1.4 },
    { note: 'C#4', time: 8.6, dur: 1.5 },
    { note: 'F#4', time: 9.0, dur: 2.2 },
    // "Barson ki yaadein..."
    { note: 'F#4', time: 10.5, dur: 0.8 },
    { note: 'G4',  time: 11.2, dur: 0.7 },
    { note: 'F#4', time: 11.8, dur: 0.7 },
    { note: 'E4',  time: 12.4, dur: 0.9 },
    { note: 'D4',  time: 13.2, dur: 1.8 },
    // "Humnava mere tu hai toh..."
    { note: 'F#4', time: 15.0, dur: 0.9 },
    { note: 'A4',  time: 15.8, dur: 1.2 },
    { note: 'G4',  time: 17.0, dur: 0.8 },
    { note: 'F#4', time: 17.8, dur: 0.8 },
    { note: 'E4',  time: 18.5, dur: 1.8 },
    // "Meri saansein chale..."
    { note: 'D4',  time: 20.4, dur: 0.8 },
    { note: 'E4',  time: 21.1, dur: 0.8 },
    { note: 'F#4', time: 21.8, dur: 1.4 },
    { note: 'E4',  time: 23.0, dur: 0.9 },
    { note: 'D4',  time: 23.8, dur: 0.9 },
    { note: 'C#4', time: 24.6, dur: 1.8 },
    { note: 'B3',  time: 26.2, dur: 3.5 },
    // Repeat chorus
    { note: 'F#4', time: 29.5, dur: 0.8 },
    { note: 'G4',  time: 30.2, dur: 0.7 },
    { note: 'F#4', time: 30.8, dur: 0.7 },
    { note: 'E4',  time: 31.4, dur: 0.9 },
    { note: 'D4',  time: 32.2, dur: 1.8 },
    { note: 'F#4', time: 34.0, dur: 0.9 },
    { note: 'A4',  time: 34.8, dur: 1.2 },
    { note: 'G4',  time: 36.0, dur: 0.8 },
    { note: 'F#4', time: 36.8, dur: 0.8 },
    { note: 'E4',  time: 37.5, dur: 1.8 },
    { note: 'D4',  time: 39.4, dur: 0.8 },
    { note: 'E4',  time: 40.1, dur: 0.8 },
    { note: 'F#4', time: 40.8, dur: 1.4 },
    { note: 'E4',  time: 42.0, dur: 0.9 },
    { note: 'C#4', time: 42.8, dur: 1.2 },
    { note: 'B3',  time: 43.8, dur: 4.5 },
  ];

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private playTone(freq: number, duration: number, when: number, gainVal = 0.25) {
    const ctx = this.getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle'; // Warm, soft acoustic tone
    osc.frequency.setValueAtTime(freq, when);

    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(gainVal, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(when);
    osc.stop(when + duration);
  }

  public play(onUpdate?: (time: number, duration: number) => void, onEnd?: () => void) {
    this.onTimeUpdateCallback = onUpdate || null;
    this.onEndedCallback = onEnd || null;
    this.isPlaying = true;

    const ctx = this.getAudioContext();
    const now = ctx.currentTime;
    this.startTime = Date.now();

    this.melody.forEach((m) => {
      const freq = this.notes[m.note];
      if (freq) {
        this.playTone(freq, m.dur, now + m.time, 0.22);
      }
    });

    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = window.setInterval(() => {
      if (!this.isPlaying) return;
      const elapsedSec = (Date.now() - this.startTime) / 1000;
      if (elapsedSec >= this.totalDuration) {
        this.stop();
        if (this.onEndedCallback) this.onEndedCallback();
      } else {
        if (this.onTimeUpdateCallback) {
          this.onTimeUpdateCallback(elapsedSec, this.totalDuration);
        }
      }
    }, 200);
  }

  public pause() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  public stop() {
    this.isPlaying = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}

export const humnavaSynth = new HumnavaSynthesizer();
