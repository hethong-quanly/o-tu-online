/* WebAudio SFX + soft loop music — original synth, no external assets */
(function (global) {
  'use strict';

  function OtuAudio() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicOn = true;
    this.sfxOn = true;
    this._started = false;
    this._musicNodes = [];
    this._stepAt = 0;
    this._cookAt = 0;
    try {
      const s = JSON.parse(localStorage.getItem('otu_audio') || '{}');
      if (typeof s.musicOn === 'boolean') this.musicOn = s.musicOn;
      if (typeof s.sfxOn === 'boolean') this.sfxOn = s.sfxOn;
    } catch (_) {}
  }

  OtuAudio.prototype._save = function () {
    try { localStorage.setItem('otu_audio', JSON.stringify({ musicOn: this.musicOn, sfxOn: this.sfxOn })); } catch (_) {}
  };

  OtuAudio.prototype.ensure = function () {
    if (this._started) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.musicOn ? 0.18 : 0;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.sfxOn ? 0.55 : 0;
    this.sfxGain.connect(this.master);
    this._started = true;
    if (this.ctx.state === 'suspended') this.ctx.resume();
    this._startMusic();
    return true;
  };

  OtuAudio.prototype.resume = function () {
    if (!this.ensure()) return;
    if (this.ctx.state === 'suspended') this.ctx.resume();
  };

  OtuAudio.prototype.setMusic = function (on) {
    this.musicOn = !!on;
    if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? 0.18 : 0, this.ctx.currentTime, 0.05);
    this._save();
  };

  OtuAudio.prototype.setSfx = function (on) {
    this.sfxOn = !!on;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? 0.55 : 0, this.ctx.currentTime, 0.05);
    this._save();
  };

  OtuAudio.prototype.toggleMusic = function () {
    this.setMusic(!this.musicOn);
    return this.musicOn;
  };

  OtuAudio.prototype.toggleSfx = function () {
    this.setSfx(!this.sfxOn);
    return this.sfxOn;
  };

  OtuAudio.prototype._tone = function (freq, dur, type, gain, dest, slide) {
    if (!this._started || !dest) return;
    const t0 = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, slide), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain || 0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(dest);
    o.start(t0); o.stop(t0 + dur + 0.02);
  };

  OtuAudio.prototype._noise = function (dur, gain, dest, filterFreq) {
    if (!this._started || !dest) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = filterFreq || 800;
    f.Q.value = 0.8;
    const g = this.ctx.createGain();
    const t0 = this.ctx.currentTime;
    g.gain.setValueAtTime(gain || 0.15, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur);
  };

  OtuAudio.prototype._startMusic = function () {
    // Soft looping pentatonic pad + plucky motif (original)
    const scale = [196, 220, 246.94, 293.66, 329.63, 392, 440];
    const beat = 0.55;
    const playBar = () => {
      if (!this._started || !this.musicOn) {
        this._musicTimer = setTimeout(playBar, 800);
        return;
      }
      const t0 = this.ctx.currentTime;
      // pad
      [scale[0], scale[2], scale[4]].forEach((f, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f / (i === 0 ? 2 : 1);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.045, t0 + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + beat * 8);
        o.connect(g); g.connect(this.musicGain);
        o.start(t0); o.stop(t0 + beat * 8 + 0.05);
      });
      // melody
      for (let i = 0; i < 8; i++) {
        const f = scale[(i * 3 + Math.floor(Math.random() * 2)) % scale.length];
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        const tt = t0 + i * beat;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.07, tt + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, tt + beat * 0.85);
        o.connect(g); g.connect(this.musicGain);
        o.start(tt); o.stop(tt + beat);
      }
      this._musicTimer = setTimeout(playBar, beat * 8 * 1000);
    };
    playBar();
  };

  OtuAudio.prototype.footstep = function () {
    if (!this.sfxOn || !this.ensure()) return;
    const now = performance.now();
    if (now - this._stepAt < 280) return;
    this._stepAt = now;
    this._noise(0.08, 0.12, this.sfxGain, 350 + Math.random() * 200);
    this._tone(90 + Math.random() * 30, 0.06, 'sine', 0.08, this.sfxGain);
  };

  OtuAudio.prototype.pushup = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this._tone(120, 0.12, 'sawtooth', 0.12, this.sfxGain, 70);
    setTimeout(() => this._noise(0.1, 0.1, this.sfxGain, 200), 80);
    setTimeout(() => this._tone(160, 0.1, 'triangle', 0.1, this.sfxGain, 100), 160);
  };

  OtuAudio.prototype.cook = function () {
    if (!this.sfxOn || !this.ensure()) return;
    const now = performance.now();
    if (now - this._cookAt < 900) return;
    this._cookAt = now;
    this._noise(0.25, 0.08, this.sfxGain, 2400);
    this._tone(520, 0.05, 'square', 0.04, this.sfxGain);
    setTimeout(() => this._tone(440, 0.05, 'square', 0.03, this.sfxGain), 120);
  };

  OtuAudio.prototype.alert = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this._tone(880, 0.15, 'square', 0.15, this.sfxGain, 660);
    setTimeout(() => this._tone(660, 0.2, 'square', 0.12, this.sfxGain, 440), 150);
  };

  OtuAudio.prototype.coin = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this._tone(660, 0.08, 'sine', 0.12, this.sfxGain);
    setTimeout(() => this._tone(990, 0.12, 'sine', 0.1, this.sfxGain), 70);
  };

  OtuAudio.prototype.click = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this._tone(440, 0.04, 'triangle', 0.06, this.sfxGain);
  };

  global.OtuAudio = OtuAudio;
})(typeof window !== 'undefined' ? window : globalThis);
