/* Original pixel-style character drawers (not copied from any game). */
(function (global) {
  function px(ctx, x, y, w, h, color) {
    ctx.fillStyle = color;
    ctx.fillRect(x | 0, y | 0, w | 0, h | 0);
  }

  const STRIPES = {
    bw: { light: '#f5f5f5', dark: '#151515' },
    blue: { light: '#e8f0ff', dark: '#1a3050' },
    orange: { light: '#fff0e0', dark: '#6a3010' },
  };

  function drawPrisoner(ctx, x, y, scale, opts) {
    opts = opts || {};
    const s = scale || 3;
    const face = opts.facing == null ? 1 : opts.facing;
    const skin = opts.skin || '#e0b090';
    const hair = opts.hair || '#2a2218';
    const stripe = STRIPES[opts.stripe] || STRIPES.bw;
    const emote = opts.emote || null;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * s, s);

    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();

    if (emote === 'sleep' || emote === 'sit') {
      // reclining / sitting low
      px(ctx, -6, 6, 4, 3, '#1a1a1a');
      px(ctx, 2, 6, 4, 3, '#1a1a1a');
      for (let i = 0; i < 7; i++) {
        px(ctx, -6, -1 + i, 12, 1, i % 2 === 0 ? stripe.light : stripe.dark);
      }
      px(ctx, -8, 1, 2, 5, skin);
      px(ctx, 6, 1, 2, 5, skin);
      px(ctx, -4, -8, 8, 7, skin);
      px(ctx, -4, -9, 8, 2, hair);
      if (emote === 'sleep') {
        ctx.fillStyle = '#f0d28e';
        ctx.font = '3px sans-serif';
        ctx.fillText('z', 6, -10);
      }
    } else if (emote === 'pushup') {
      px(ctx, -10, 8, 20, 2, '#1a1a1a');
      for (let i = 0; i < 5; i++) {
        px(ctx, -8, 2 + i, 16, 1, i % 2 === 0 ? stripe.light : stripe.dark);
      }
      px(ctx, -11, 4, 3, 2, skin);
      px(ctx, 8, 4, 3, 2, skin);
      px(ctx, -4, -2, 8, 6, skin);
      px(ctx, -4, -3, 8, 2, hair);
    } else {
      px(ctx, -4, 8, 3, 6, '#1a1a1a');
      px(ctx, 1, 8, 3, 6, '#1a1a1a');
      px(ctx, -5, 13, 4, 1.5, '#111');
      px(ctx, 1, 13, 4, 1.5, '#111');
      for (let i = 0; i < 7; i++) {
        px(ctx, -5, -2 + i, 10, 1, i % 2 === 0 ? stripe.light : stripe.dark);
      }
      if (emote === 'wave') {
        px(ctx, -7, -4, 2, 6, skin);
        px(ctx, 5, -8, 2, 8, skin);
        px(ctx, 5, -10, 3, 2, skin);
      } else {
        px(ctx, -7, -1, 2, 6, skin);
        px(ctx, 5, -1, 2, 6, skin);
      }
      px(ctx, -4, -9, 8, 7, skin);
      px(ctx, -4, -10, 8, 2, hair);
      px(ctx, -5, -9, 1, 3, hair);
      px(ctx, 4, -9, 1, 3, hair);
      px(ctx, -2, -6, 1.2, 1.2, '#1a120c');
      px(ctx, 1, -6, 1.2, 1.2, '#1a120c');
      px(ctx, -1, -3.5, 2, 0.8, '#a07060');
      if (opts.number) {
        px(ctx, -3, 1, 6, 3, '#111');
        ctx.fillStyle = '#eee';
        ctx.font = '2.5px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(opts.number).slice(0, 3), 0, 3.5);
      }
      if (emote === 'mark') {
        ctx.fillStyle = '#f0d28e';
        ctx.font = '4px sans-serif';
        ctx.fillText('✎', 8, -6);
      }
      if (emote === 'write') {
        ctx.fillStyle = '#f0d28e';
        ctx.font = '4px sans-serif';
        ctx.fillText('✉', 8, -6);
      }
    }
    ctx.restore();
  }

  function drawGuard(ctx, x, y, scale, opts) {
    opts = opts || {};
    const s = scale || 3;
    const face = opts.facing == null ? 1 : opts.facing;
    const skin = opts.skin || '#d4a574';
    const uni = '#5a6b3a';
    const uniDark = '#3f4c2a';
    const red = '#c62828';
    const gold = '#e6c35c';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(face * s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, -4, 8, 3, 5, uniDark);
    px(ctx, 1, 8, 3, 5, uniDark);
    px(ctx, -5, 12.5, 4, 2, '#1a1a1a');
    px(ctx, 1, 12.5, 4, 2, '#1a1a1a');
    px(ctx, -5, -2, 10, 10, uni);
    px(ctx, -5, 5, 10, 1.5, '#2a2418');
    px(ctx, -1, 4.5, 2, 2.5, gold);
    px(ctx, -5, -2, 3, 2.5, uniDark);
    px(ctx, 2, -2, 3, 2.5, uniDark);
    px(ctx, -4.5, -1.5, 2, 1.5, red);
    px(ctx, 2.5, -1.5, 2, 1.5, red);
    px(ctx, -7, -1, 2, 7, uni);
    px(ctx, 5, -1, 2, 7, uni);
    px(ctx, -7, 5.5, 2, 1.5, skin);
    px(ctx, 5, 5.5, 2, 1.5, skin);
    px(ctx, -4, -9, 8, 7, skin);
    px(ctx, -5.5, -11, 11, 3.5, uniDark);
    px(ctx, -6.5, -9, 13, 1.5, uniDark);
    px(ctx, -5, -9.8, 10, 1.2, red);
    px(ctx, -1.2, -10.6, 2.4, 2, gold);
    px(ctx, -2, -6, 1.2, 1.2, '#1a120c');
    px(ctx, 1, -6, 1.2, 1.2, '#1a120c');
    px(ctx, -1.5, -3.2, 3, 0.7, '#8a5a4a');
    ctx.restore();
  }

  function drawNameTag(ctx, x, y, text, highlight) {
    ctx.save();
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = Math.max(48, ctx.measureText(text).width + 18);
    const h = 22;
    const rx = x - w / 2;
    const ry = y - h;
    ctx.fillStyle = highlight ? 'rgba(48, 30, 14, 0.92)' : 'rgba(22, 15, 10, 0.78)';
    ctx.strokeStyle = highlight ? '#d4a857' : 'rgba(212, 168, 87, 0.35)';
    ctx.lineWidth = 1.5;
    roundRect(ctx, rx, ry, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = highlight ? '#f0d28e' : '#faf6ec';
    ctx.fillText(text, x, y - 7);
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  global.OtuSprites = { drawPrisoner, drawGuard, drawNameTag, STRIPES };
})(typeof window !== 'undefined' ? window : global);
