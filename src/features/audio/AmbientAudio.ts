/**
 * Generative ambient soundscape (100% Web Audio, no audio files):
 *   - Lo-fi pad: Dmaj7 → Bm7 → Gmaj7 → A7sus4, two bars each at 68 BPM, soft bass,
 *     sparse Rhodes-like arpeggio, all through a generated convolution reverb.
 *   - Ocean: distant surf bed + waves that wash in and out every 6–11 s (panned seaward).
 *   - Breeze that grows with riding speed, and the occasional far-off gull.
 * Starts on the first user gesture (browser autoplay policy) and remembers mute state.
 */

const STORAGE_KEY = "aqb-sound";
const BPM = 68;
const BEAT = 60 / BPM;
const BARS_PER_CHORD = 2;

// MIDI voicings (mellow mid-register)
const CHORDS: { pad: number[]; bass: number; arp: number[] }[] = [
  { pad: [50, 57, 61, 66], bass: 38, arp: [69, 73, 74, 78, 81] }, // Dmaj7
  { pad: [47, 57, 62, 66], bass: 35, arp: [66, 69, 71, 74, 78] }, // Bm7
  { pad: [43, 54, 59, 62], bass: 31, arp: [66, 67, 71, 74, 79] }, // Gmaj7
  { pad: [45, 55, 62, 64], bass: 33, arp: [67, 69, 74, 76, 81] }, // A7sus4
];

const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

function readPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

function writePref(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    /* storage unavailable (private mode) — ignore */
  }
}

export class AmbientAudio {
  public enabled = readPref();
  public onStateChange?: (enabled: boolean, started: boolean) => void;

  private ctx?: AudioContext;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverbSend!: GainNode;
  private noise!: AudioBuffer;
  private windGain!: GainNode;
  private oceanWash!: GainNode;
  private oceanFilter!: BiquadFilterNode;

  private started = false;
  private schedulerId = 0;
  private nextBeatTime = 0;
  private beatIndex = 0;
  private nextWaveTime = 0;
  private nextGullTime = 0;
  private speed = 0;

  constructor() {
    window.addEventListener("pointerdown", this.handleGesture, { capture: true });
    window.addEventListener("keydown", this.handleGesture, { capture: true });
    document.addEventListener("visibilitychange", this.handleVisibility);
  }

  public get isStarted(): boolean {
    return this.started;
  }

  /** Riding speed 0 (cruise) … 1 (full boost): drives the breeze level. */
  public setSpeed(speedFactor: number): void {
    this.speed = speedFactor;
    if (!this.ctx || !this.started) return;
    const target = 0.012 + speedFactor * 0.045;
    this.windGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.6);
  }

  public setEnabled(on: boolean): void {
    this.enabled = on;
    writePref(on);
    if (on && !this.started) this.start();
    if (this.ctx && this.started) {
      const now = this.ctx.currentTime;
      if (on) {
        void this.ctx.resume();
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(0.55, now, 0.8);
      } else {
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(0, now, 0.25);
      }
    }
    this.onStateChange?.(this.enabled, this.started);
  }

  public toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  public dispose(): void {
    window.removeEventListener("pointerdown", this.handleGesture, { capture: true });
    window.removeEventListener("keydown", this.handleGesture, { capture: true });
    document.removeEventListener("visibilitychange", this.handleVisibility);
    clearInterval(this.schedulerId);
    void this.ctx?.close();
    this.ctx = undefined;
    this.onStateChange = undefined;
  }

  // ---------------------------------------------------------------------------

  private handleGesture = (): void => {
    if (this.enabled && !this.started) this.start();
  };

  private handleVisibility = (): void => {
    if (!this.ctx || !this.started) return;
    if (document.hidden) void this.ctx.suspend();
    else if (this.enabled) void this.ctx.resume();
  };

  private start(): void {
    if (this.started) return;
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    this.ctx = ctx;
    this.started = true;

    // Master chain: buses → gentle compressor → master fade → speakers
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 3;
    comp.attack.value = 0.05;
    comp.release.value = 0.4;
    this.master = ctx.createGain();
    this.master.gain.value = 0;
    comp.connect(this.master).connect(ctx.destination);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.musicBus.connect(comp);
    this.sfxBus.connect(comp);

    const reverb = ctx.createConvolver();
    reverb.buffer = this.createImpulse(ctx, 3.8, 2.6);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 0.6;
    this.reverbSend.connect(reverb).connect(this.musicBus);

    this.noise = this.createPinkNoise(ctx, 6);
    this.buildOcean(ctx);
    this.buildWind(ctx);

    const now = ctx.currentTime;
    this.nextBeatTime = now + 0.3;
    this.nextWaveTime = now + 1.5;
    this.nextGullTime = now + 8 + Math.random() * 10;
    this.schedulerId = window.setInterval(() => this.schedule(), 120);
    this.schedule();

    if (this.enabled) this.master.gain.setTargetAtTime(0.55, now, 1.5);
    this.setSpeed(this.speed);
    this.onStateChange?.(this.enabled, this.started);
  }

  // --- Sound sources ---------------------------------------------------------

  private loopNoise(ctx: AudioContext): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.loopStart = Math.random() * 2;
    src.start(ctx.currentTime, Math.random() * 4);
    return src;
  }

  private buildOcean(ctx: AudioContext): void {
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.35; // the sea is on the rider's right
    pan.connect(this.sfxBus);

    // Constant low surf rumble
    const bedFilter = ctx.createBiquadFilter();
    bedFilter.type = "lowpass";
    bedFilter.frequency.value = 260;
    const bedGain = ctx.createGain();
    bedGain.gain.value = 0.16;
    this.loopNoise(ctx).connect(bedFilter).connect(bedGain).connect(pan);

    // Waves washing in and out (envelopes scheduled in `schedule`)
    this.oceanFilter = ctx.createBiquadFilter();
    this.oceanFilter.type = "lowpass";
    this.oceanFilter.frequency.value = 420;
    this.oceanFilter.Q.value = 0.4;
    this.oceanWash = ctx.createGain();
    this.oceanWash.gain.value = 0.04;
    this.loopNoise(ctx).connect(this.oceanFilter).connect(this.oceanWash).connect(pan);
  }

  private buildWind(ctx: AudioContext): void {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 820;
    band.Q.value = 0.6;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0.012;
    // Slow gusting
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 260;
    lfo.connect(lfoDepth).connect(band.frequency);
    lfo.start();
    this.loopNoise(ctx).connect(band).connect(this.windGain).connect(this.sfxBus);
  }

  private scheduleWave(t: number): void {
    const g = this.oceanWash.gain;
    const f = this.oceanFilter.frequency;
    const peak = 0.22 + Math.random() * 0.12;
    g.setTargetAtTime(peak, t, 0.9); // swell + break
    f.setTargetAtTime(1300 + Math.random() * 500, t, 0.8);
    g.setTargetAtTime(0.05, t + 2.6, 1.6); // hiss as it retreats
    f.setTargetAtTime(420, t + 2.6, 1.4);
  }

  private scheduleGull(ctx: AudioContext, t: number): void {
    const pan = ctx.createStereoPanner();
    pan.pan.value = -0.2 + Math.random() * 1.0;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 1500;
    band.Q.value = 2.5;
    const out = ctx.createGain();
    out.gain.value = 0.022;
    band.connect(out).connect(pan);
    pan.connect(this.sfxBus);
    out.connect(this.reverbSend);

    const calls = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < calls; i++) {
      const start = t + i * (0.32 + Math.random() * 0.1);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      const env = ctx.createGain();
      env.gain.value = 0;
      const f0 = 1750 + Math.random() * 300;
      osc.frequency.setValueAtTime(f0, start);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.62, start + 0.24);
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(1, start + 0.03);
      env.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(env).connect(band);
      osc.start(start);
      osc.stop(start + 0.3);
      if (i === calls - 1) {
        // Let the reverb tail ring, then release the per-call nodes
        osc.onended = () => window.setTimeout(() => (pan.disconnect(), out.disconnect(), band.disconnect()), 4000);
      }
    }
  }

  // --- Music -----------------------------------------------------------------

  private playPad(ctx: AudioContext, notes: number[], t: number, dur: number): void {
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 950;
    filter.Q.value = 0.3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.05, t + 1.8);
    env.gain.setValueAtTime(0.05, t + dur - 0.2);
    env.gain.linearRampToValueAtTime(0, t + dur + 2.2);
    filter.connect(env);
    env.connect(this.musicBus);
    env.connect(this.reverbSend);

    for (const n of notes) {
      for (const [type, detune] of [["sine", -6], ["triangle", 6]] as [OscillatorType, number][]) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = midiToHz(n);
        osc.detune.value = detune;
        const vg = ctx.createGain();
        vg.gain.value = type === "sine" ? 0.55 : 0.25;
        osc.connect(vg).connect(filter);
        osc.start(t);
        osc.stop(t + dur + 2.4);
        osc.onended = () => vg.disconnect();
      }
    }
    window.setTimeout(() => (filter.disconnect(), env.disconnect()), (t - ctx.currentTime + dur + 6) * 1000);
  }

  private playBass(ctx: AudioContext, note: number, t: number, dur: number): void {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = midiToHz(note);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.085, t + 0.25);
    env.gain.setTargetAtTime(0.05, t + 0.3, 1.2);
    env.gain.linearRampToValueAtTime(0, t + dur);
    osc.connect(env).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
    osc.onended = () => env.disconnect();
  }

  private playKey(ctx: AudioContext, note: number, t: number): void {
    const f = midiToHz(note);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.03, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0008, t + 2.4);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.6;
    env.connect(pan);
    pan.connect(this.musicBus);
    pan.connect(this.reverbSend);

    // Sine + soft bell partial ≈ electric-piano tine
    for (const [mult, gain] of [[1, 1], [2, 0.18], [3.01, 0.05]]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * mult;
      const g = ctx.createGain();
      g.gain.value = gain;
      osc.connect(g).connect(env);
      osc.start(t);
      osc.stop(t + 2.5);
      osc.onended = () => g.disconnect();
    }
    window.setTimeout(() => (env.disconnect(), pan.disconnect()), (t - ctx.currentTime + 6) * 1000);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === "closed") return;
    const horizon = ctx.currentTime + 0.6;

    while (this.nextBeatTime < horizon) {
      const t = this.nextBeatTime;
      const beatsPerChord = BARS_PER_CHORD * 4;
      const chord = CHORDS[Math.floor(this.beatIndex / beatsPerChord) % CHORDS.length];
      const beatInChord = this.beatIndex % beatsPerChord;

      if (beatInChord === 0) {
        this.playPad(ctx, chord.pad, t, beatsPerChord * BEAT);
        this.playBass(ctx, chord.bass, t, beatsPerChord * BEAT * 0.95);
      }
      // Sparse, unhurried arpeggio (more notes on strong beats)
      const p = beatInChord % 4 === 0 ? 0.7 : 0.4;
      if (Math.random() < p) {
        const note = chord.arp[Math.floor(Math.random() * chord.arp.length)];
        const swing = Math.random() < 0.3 ? BEAT * 0.5 : 0;
        this.playKey(ctx, note, t + swing);
      }

      this.nextBeatTime += BEAT;
      this.beatIndex++;
    }

    while (this.nextWaveTime < horizon) {
      this.scheduleWave(this.nextWaveTime);
      this.nextWaveTime += 6 + Math.random() * 5;
    }
    while (this.nextGullTime < horizon) {
      this.scheduleGull(ctx, this.nextGullTime);
      this.nextGullTime += 14 + Math.random() * 18;
    }
  }

  // --- Buffers ---------------------------------------------------------------

  /** Pink-ish noise (Paul Kellet filter) — softer than white noise for surf and wind. */
  private createPinkNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < data.length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.969 * b2 + white * 0.153852;
        b3 = 0.8665 * b3 + white * 0.3104856;
        b4 = 0.55 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.016898;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  /** Stereo exponentially-decaying noise impulse response for a soft hall reverb. */
  private createImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buffer;
  }
}
