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
    this._unlocked = false;
    this._musicTimer = null;
    this._stepAt = 0;
    this._cookAt = 0;
    try {
      const s = JSON.parse(localStorage.getItem('otu_audio') || '{}');
      if (typeof s.musicOn === 'boolean') this.musicOn = s.musicOn;
      if (typeof s.sfxOn === 'boolean') this.sfxOn = s.sfxOn;
    } catch (_) {}
  }

  OtuAudio.prototype._save = function () {
    try {
      localStorage.setItem('otu_audio', JSON.stringify({ musicOn: this.musicOn, sfxOn: this.sfxOn }));
    } catch (_) {}
  };

  OtuAudio.prototype.ensure = function () {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!this.ctx) {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 1.0;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.32 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxOn ? 0.85 : 0;
      this.sfxGain.connect(this.master);
      this._started = true;
      this._startMusic();
    }
    return true;
  };

  OtuAudio.prototype.resume = function () {
    if (!this.ensure()) return Promise.resolve(false);
    const finish = () => {
      this._unlocked = this.ctx.state === 'running';
      return this._unlocked;
    };
    if (this.ctx.state === 'suspended') {
      return this.ctx.resume().then(finish).catch(() => false);
    }
    return Promise.resolve(finish());
  };

  OtuAudio.prototype.state = function () {
    return this.ctx ? this.ctx.state : 'none';
  };

  OtuAudio.prototype.setMusic = function (on) {
    this.musicOn = !!on;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.05);
    }
    this._save();
  };

  OtuAudio.prototype.setSfx = function (on) {
    this.sfxOn = !!on;
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.05);
    }
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
    if (!this._started || !dest || !this.ctx) return;
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
    if (!this._started || !dest || !this.ctx) return;
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
    const scale = [196, 220, 246.94, 293.66, 329.63, 392, 440];
    const beat = 0.55;
    const playBar = () => {
      if (!this._started) return;
      if (!this.musicOn || !this.ctx || this.ctx.state !== 'running') {
        this._musicTimer = setTimeout(playBar, 900);
        return;
      }
      const t0 = this.ctx.currentTime;
      [scale[0], scale[2], scale[4]].forEach((f, i) => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.value = f / (i === 0 ? 2 : 1);
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.linearRampToValueAtTime(0.07, t0 + 0.4);
        g.gain.linearRampToValueAtTime(0.0001, t0 + beat * 8);
        o.connect(g); g.connect(this.musicGain);
        o.start(t0); o.stop(t0 + beat * 8 + 0.05);
      });
      for (let i = 0; i < 8; i++) {
        const f = scale[(i * 3 + Math.floor(Math.random() * 2)) % scale.length];
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        const tt = t0 + i * beat;
        g.gain.setValueAtTime(0.0001, tt);
        g.gain.exponentialRampToValueAtTime(0.11, tt + 0.03);
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
    if (this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - this._stepAt < 280) return;
    this._stepAt = now;
    this._noise(0.08, 0.22, this.sfxGain, 350 + Math.random() * 200);
    this._tone(90 + Math.random() * 30, 0.06, 'sine', 0.14, this.sfxGain);
  };

  OtuAudio.prototype.pushup = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._tone(120, 0.12, 'sawtooth', 0.2, this.sfxGain, 70);
    setTimeout(() => this._noise(0.1, 0.16, this.sfxGain, 200), 80);
    setTimeout(() => this._tone(160, 0.1, 'triangle', 0.16, this.sfxGain, 100), 160);
  };

  OtuAudio.prototype.cook = function () {
    if (!this.sfxOn || !this.ensure()) return;
    if (this.ctx.state !== 'running') return;
    const now = performance.now();
    if (now - this._cookAt < 900) return;
    this._cookAt = now;
    this._noise(0.28, 0.14, this.sfxGain, 2400);
    this._tone(520, 0.05, 'square', 0.08, this.sfxGain);
    setTimeout(() => this._tone(440, 0.05, 'square', 0.06, this.sfxGain), 120);
  };

  OtuAudio.prototype.alert = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._tone(880, 0.15, 'square', 0.22, this.sfxGain, 660);
    setTimeout(() => this._tone(660, 0.2, 'square', 0.18, this.sfxGain, 440), 150);
  };

  OtuAudio.prototype.coin = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._tone(660, 0.08, 'sine', 0.18, this.sfxGain);
    setTimeout(() => this._tone(990, 0.12, 'sine', 0.15, this.sfxGain), 70);
  };

  OtuAudio.prototype.click = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._tone(440, 0.04, 'triangle', 0.1, this.sfxGain);
  };

  OtuAudio.prototype.rankUp = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._tone(392, 0.12, 'triangle', 0.2, this.sfxGain);
    setTimeout(() => this._tone(523.25, 0.14, 'triangle', 0.22, this.sfxGain), 100);
    setTimeout(() => this._tone(659.25, 0.22, 'sine', 0.24, this.sfxGain), 220);
    setTimeout(() => this._noise(0.15, 0.1, this.sfxGain, 1200), 280);
  };

  OtuAudio.prototype.sing = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    const notes = [392, 440, 494, 523, 587, 523];
    notes.forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 'sine', 0.2, this.sfxGain), i * 160));
  };

  OtuAudio.prototype.dance = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    for (let i = 0; i < 4; i++) {
      setTimeout(() => {
        this._noise(0.06, 0.18, this.sfxGain, 180);
        this._tone(220 + i * 40, 0.08, 'square', 0.12, this.sfxGain);
      }, i * 200);
    }
  };

  OtuAudio.prototype.story = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._tone(280, 0.15, 'triangle', 0.14, this.sfxGain);
    setTimeout(() => this._tone(320, 0.2, 'triangle', 0.12, this.sfxGain), 180);
    setTimeout(() => this._tone(260, 0.22, 'sine', 0.12, this.sfxGain), 360);
  };

  OtuAudio.prototype.martial = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._noise(0.08, 0.22, this.sfxGain, 600);
    setTimeout(() => this._tone(180, 0.1, 'sawtooth', 0.18, this.sfxGain, 90), 60);
    setTimeout(() => this._noise(0.1, 0.2, this.sfxGain, 400), 180);
  };

  OtuAudio.prototype.cheer = function () {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    this._noise(0.2, 0.22, this.sfxGain, 1500);
    this._tone(660, 0.08, 'triangle', 0.14, this.sfxGain);
    setTimeout(() => this._tone(880, 0.1, 'triangle', 0.12, this.sfxGain), 90);
  };

  OtuAudio.prototype.rhythmHit = function (perfect) {
    if (!this.sfxOn || !this.ensure()) return;
    this.resume();
    if (perfect) this._tone(880, 0.06, 'sine', 0.22, this.sfxGain);
    else this._tone(520, 0.05, 'triangle', 0.14, this.sfxGain);
  };

  OtuAudio.prototype.perform = function (kind) {
    if (kind === 'sing') this.sing();
    else if (kind === 'dance') this.dance();
    else if (kind === 'story') this.story();
    else if (kind === 'martial') this.martial();
    else if (kind === 'pushup_show' || kind === 'pushup') this.pushup();
    else this.click();
  };

  global.OtuAudio = OtuAudio;
})(typeof window !== 'undefined' ? window : globalThis);
