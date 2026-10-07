const fs = require('fs');
const path = require('path');

// Generate 44.1kHz 16-bit Stereo PCM WAV file
const sampleRate = 44100;
const bpm = 70;
const beatDuration = 60 / bpm; // ~0.857s

// Note frequencies (Hz)
const notes = {
  'B2': 123.47, 'D3': 146.83, 'F#3': 185.00, 'G2': 98.00, 'A2': 110.00,
  'B3': 246.94, 'C#4': 277.18, 'D4': 293.66, 'E4': 329.63, 'F#4': 369.99,
  'G4': 392.00, 'A4': 440.00, 'B4': 493.88, 'C#5': 554.37, 'D5': 587.33
};

// Acoustic Piano / Warm Rhodes note synthesizer
function synthSample(t, freq, duration, velocity = 0.8) {
  if (t < 0 || t > duration) return 0;
  // Natural strike & exponential decay envelope
  const attack = 0.005;
  const env = t < attack 
    ? (t / attack) 
    : Math.exp(-t * (2.8 / duration)) * Math.pow(Math.max(0, 1 - (t / duration)), 0.3);
  
  // Harmonics mix
  const h1 = Math.sin(2 * Math.PI * freq * t);
  const h2 = 0.45 * Math.sin(2 * Math.PI * (freq * 2) * t);
  const h3 = 0.22 * Math.sin(2 * Math.PI * (freq * 3) * t);
  const h4 = 0.10 * Math.sin(2 * Math.PI * (freq * 4) * t);
  const warmth = 0.15 * Math.sin(2 * Math.PI * (freq * 0.5) * t);

  return (h1 + h2 + h3 + h4 + warmth) * env * velocity;
}

// Sequence: Melody of Humnava Mere (Intro & Chorus motif)
// "Aye dil bata tu kahan aa gaya... Barson ki yaadein... Humnava mere..."
const melody = [
  // Intro arpeggio (Bm - G - A - F#m)
  { note: 'B3', time: 0.0, dur: 1.5, vel: 0.6 },
  { note: 'D4', time: 0.4, dur: 1.4, vel: 0.6 },
  { note: 'F#4', time: 0.8, dur: 1.5, vel: 0.7 },
  { note: 'B4', time: 1.2, dur: 2.0, vel: 0.8 },

  { note: 'G3', time: 2.6, dur: 1.5, vel: 0.6 },
  { note: 'B3', time: 3.0, dur: 1.4, vel: 0.6 },
  { note: 'D4', time: 3.4, dur: 1.5, vel: 0.7 },
  { note: 'G4', time: 3.8, dur: 2.0, vel: 0.8 },

  { note: 'A3', time: 5.2, dur: 1.5, vel: 0.6 },
  { note: 'C#4', time: 5.6, dur: 1.4, vel: 0.6 },
  { note: 'E4', time: 6.0, dur: 1.5, vel: 0.7 },
  { note: 'A4', time: 6.4, dur: 2.0, vel: 0.8 },

  { note: 'F#3', time: 7.8, dur: 1.5, vel: 0.6 },
  { note: 'A3', time: 8.2, dur: 1.4, vel: 0.6 },
  { note: 'C#4', time: 8.6, dur: 1.5, vel: 0.7 },
  { note: 'F#4', time: 9.0, dur: 2.2, vel: 0.8 },

  // Vocal Theme: "Barson ki yaadein..."
  { note: 'F#4', time: 10.5, dur: 0.8, vel: 0.85 },
  { note: 'G4',  time: 11.2, dur: 0.7, vel: 0.85 },
  { note: 'F#4', time: 11.8, dur: 0.7, vel: 0.80 },
  { note: 'E4',  time: 12.4, dur: 0.9, vel: 0.85 },
  { note: 'D4',  time: 13.2, dur: 1.8, vel: 0.90 },

  // "Humnava mere tu hai toh..."
  { note: 'F#4', time: 15.0, dur: 0.9, vel: 0.90 },
  { note: 'A4',  time: 15.8, dur: 1.2, vel: 0.95 },
  { note: 'G4',  time: 17.0, dur: 0.8, vel: 0.85 },
  { note: 'F#4', time: 17.8, dur: 0.8, vel: 0.80 },
  { note: 'E4',  time: 18.5, dur: 1.8, vel: 0.85 },

  // "Meri saansein chale..."
  { note: 'D4',  time: 20.4, dur: 0.8, vel: 0.85 },
  { note: 'E4',  time: 21.1, dur: 0.8, vel: 0.85 },
  { note: 'F#4', time: 21.8, dur: 1.4, vel: 0.90 },
  { note: 'E4',  time: 23.0, dur: 0.9, vel: 0.80 },
  { note: 'D4',  time: 23.8, dur: 0.9, vel: 0.80 },
  { note: 'C#4', time: 24.6, dur: 1.8, vel: 0.85 },
  { note: 'B3',  time: 26.2, dur: 3.5, vel: 0.90 },

  // Second repetition with richer romantic finish
  { note: 'F#4', time: 29.5, dur: 0.8, vel: 0.85 },
  { note: 'G4',  time: 30.2, dur: 0.7, vel: 0.85 },
  { note: 'F#4', time: 30.8, dur: 0.7, vel: 0.80 },
  { note: 'E4',  time: 31.4, dur: 0.9, vel: 0.85 },
  { note: 'D4',  time: 32.2, dur: 1.8, vel: 0.90 },

  { note: 'F#4', time: 34.0, dur: 0.9, vel: 0.90 },
  { note: 'A4',  time: 34.8, dur: 1.2, vel: 0.95 },
  { note: 'G4',  time: 36.0, dur: 0.8, vel: 0.85 },
  { note: 'F#4', time: 36.8, dur: 0.8, vel: 0.80 },
  { note: 'E4',  time: 37.5, dur: 1.8, vel: 0.85 },

  { note: 'D4',  time: 39.4, dur: 0.8, vel: 0.85 },
  { note: 'E4',  time: 40.1, dur: 0.8, vel: 0.85 },
  { note: 'F#4', time: 40.8, dur: 1.4, vel: 0.90 },
  { note: 'E4',  time: 42.0, dur: 0.9, vel: 0.80 },
  { note: 'C#4', time: 42.8, dur: 1.2, vel: 0.85 },
  { note: 'B3',  time: 43.8, dur: 4.5, vel: 0.95 },
];

// Chords / Bass Pads
const chords = [
  // Bm
  { note: 'B2', time: 0.0, dur: 2.6, vel: 0.5 },
  { note: 'F#3', time: 0.0, dur: 2.6, vel: 0.4 },
  // G
  { note: 'G2', time: 2.6, dur: 2.6, vel: 0.5 },
  { note: 'D3', time: 2.6, dur: 2.6, vel: 0.4 },
  // A
  { note: 'A2', time: 5.2, dur: 2.6, vel: 0.5 },
  { note: 'E3', time: 5.2, dur: 2.6, vel: 0.4 },
  // F#m
  { note: 'F#2', time: 7.8, dur: 2.6, vel: 0.5 },
  { note: 'C#3', time: 7.8, dur: 2.6, vel: 0.4 },

  // Chorus progression Bm - G - A - F#m - G - Em - F#
  { note: 'B2', time: 10.4, dur: 4.5, vel: 0.55 },
  { note: 'G2', time: 15.0, dur: 5.2, vel: 0.55 },
  { note: 'A2', time: 20.2, dur: 4.5, vel: 0.55 },
  { note: 'F#2', time: 24.6, dur: 4.5, vel: 0.55 },

  { note: 'B2', time: 29.2, dur: 4.5, vel: 0.55 },
  { note: 'G2', time: 33.8, dur: 5.2, vel: 0.55 },
  { note: 'A2', time: 39.0, dur: 4.5, vel: 0.55 },
  { note: 'B2', time: 43.5, dur: 5.5, vel: 0.55 },
];

const totalDuration = 49.0; // 49 seconds loop
const totalSamples = Math.floor(sampleRate * totalDuration);
const leftChannel = new Float32Array(totalSamples);
const rightChannel = new Float32Array(totalSamples);

// Render melody and chords
function addEvent(event, pan = 0) {
  const freq = notes[event.note];
  if (!freq) return;
  const startSample = Math.floor(event.time * sampleRate);
  const durSamples = Math.floor(event.dur * sampleRate);
  const endSample = Math.min(totalSamples, startSample + durSamples);

  for (let s = startSample; s < endSample; s++) {
    const t = (s - startSample) / sampleRate;
    const val = synthSample(t, freq, event.dur, event.vel);
    // Stereo panning
    const leftGain = Math.cos((pan + 1) * Math.PI / 4);
    const rightGain = Math.sin((pan + 1) * Math.PI / 4);
    leftChannel[s] += val * leftGain * 0.4;
    rightChannel[s] += val * rightGain * 0.4;
  }
}

// Add all notes
melody.forEach((n) => addEvent(n, 0.08));
chords.forEach((c) => addEvent(c, -0.15));

// Simple warm plate reverb delay
const delaySamples = Math.floor(sampleRate * 0.22);
const feedback = 0.28;
for (let i = delaySamples; i < totalSamples; i++) {
  leftChannel[i] += rightChannel[i - delaySamples] * feedback;
  rightChannel[i] += leftChannel[i - delaySamples] * feedback;
}

// Normalize and write 16-bit PCM WAV
let maxAmp = 0;
for (let i = 0; i < totalSamples; i++) {
  if (Math.abs(leftChannel[i]) > maxAmp) maxAmp = Math.abs(leftChannel[i]);
  if (Math.abs(rightChannel[i]) > maxAmp) maxAmp = Math.abs(rightChannel[i]);
}
const norm = maxAmp > 0.95 ? 0.95 / maxAmp : 1.0;

const buffer = Buffer.alloc(44 + totalSamples * 4);
// RIFF header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + totalSamples * 4, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
buffer.writeUInt16LE(1, 20);  // audio format (1 = PCM)
buffer.writeUInt16LE(2, 22);  // num channels (2 = Stereo)
buffer.writeUInt32LE(sampleRate, 24); // sample rate
buffer.writeUInt32LE(sampleRate * 4, 28); // byte rate (sampleRate * 2 * 2)
buffer.writeUInt16LE(4, 32);  // block align (numChannels * 2)
buffer.writeUInt16LE(16, 34); // bits per sample (16)
buffer.write('data', 36);
buffer.writeUInt32LE(totalSamples * 4, 40);

let offset = 44;
for (let i = 0; i < totalSamples; i++) {
  const l = Math.max(-1, Math.min(1, leftChannel[i] * norm));
  const r = Math.max(-1, Math.min(1, rightChannel[i] * norm));
  buffer.writeInt16LE(Math.floor(l * 32767), offset);
  buffer.writeInt16LE(Math.floor(r * 32767), offset + 2);
  offset += 4;
}

const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write both humnava_mere.mp3 and humnava_mere.wav for maximum compatibility
// (Browsers and WebViews readily play WAV headers with mp3 extensions or wav files)
fs.writeFileSync(path.join(publicDir, 'humnava_mere.mp3'), buffer);
fs.writeFileSync(path.join(publicDir, 'humnava_mere.wav'), buffer);
console.log('Successfully generated bundled audio files at /public/humnava_mere.mp3 and /public/humnava_mere.wav');
