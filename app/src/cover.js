const GRADES = {
  sunset: { wash: 'rgba(255, 92, 91, .13)', top: '#ffbd78', mid: '#ff4d8c', deep: '#35103e', accent: '#ffcc91' },
  neon:   { wash: 'rgba(33, 232, 238, .10)', top: '#2ff5f0', mid: '#d524ef', deep: '#160b36', accent: '#75fff4' },
  vice:   { wash: 'rgba(70, 222, 201, .12)', top: '#80f5d5', mid: '#f05b9e', deep: '#25113f', accent: '#ff8ab8' },
  noir:   { wash: 'rgba(238, 241, 255, .08)', top: '#fff', mid: '#7f8795', deep: '#090b10', accent: '#e9edf4' },
};

const PANEL_NAMES = ['01 / THE LEAD', '02 / THE CITY', '03 / THE GETAWAY', '04 / AFTER DARK'];

function withAlpha(hex, alpha) {
  let value = hex.slice(1);
  if (value.length === 3) value = [...value].map(part => part + part).join('');
  const channels = [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16));
  return `rgba(${channels.join(',')},${alpha})`;
}

function panelPolygons(layout, w, h) {
  if (layout === 'strip') return [
    [[0, 0], [w, 0], [w, h * .70], [0, h * .75]],
    [[0, h * .78], [w * .32, h * .75], [w * .34, h], [0, h]],
    [[w * .335, h * .75], [w * .665, h * .75], [w * .67, h], [w * .34, h]],
    [[w * .67, h * .75], [w, h * .70], [w, h], [w * .67, h]],
  ];
  if (layout === 'poster') return [[[0, 0], [w, 0], [w, h], [0, h]]];
  return [
    [[0, 0], [w * .615, 0], [w * .535, h * .58], [0, h * .72]],
    [[w * .635, 0], [w, 0], [w, h * .405], [w * .575, h * .48]],
    [[w * .575, h * .505], [w, h * .43], [w, h * .82], [w * .505, h * .72]],
    [[0, h * .75], [w * .475, h * .73], [w * .435, h], [0, h]],
  ];
}

function pathFrom(ctx, points) {
  const path = new Path2D();
  points.forEach(([x, y], i) => i ? path.lineTo(x, y) : path.moveTo(x, y));
  path.closePath();
  return path;
}

function drawPhoto(ctx, photo, panel, zoom, panX, panY) {
  if (!photo) return;
  const minX = Math.min(...panel.map(p => p[0]));
  const minY = Math.min(...panel.map(p => p[1]));
  const maxX = Math.max(...panel.map(p => p[0]));
  const maxY = Math.max(...panel.map(p => p[1]));
  const boxW = maxX - minX, boxH = maxY - minY;
  const scale = Math.max(boxW / photo.naturalWidth, boxH / photo.naturalHeight) * zoom;
  const drawW = photo.naturalWidth * scale, drawH = photo.naturalHeight * scale;
  const x = minX + (boxW - drawW) / 2 + panX;
  const y = minY + (boxH - drawH) / 2 + panY;
  ctx.drawImage(photo, x, y, drawW, drawH);
}

function drawGrade(ctx, w, h, grade) {
  const colors = GRADES[grade] ?? GRADES.sunset;
  ctx.fillStyle = colors.wash;
  ctx.fillRect(0, 0, w, h);
  const sky = ctx.createLinearGradient(0, 0, 0, h * .72);
  sky.addColorStop(0, withAlpha(colors.top, .13));
  sky.addColorStop(.52, withAlpha(colors.mid, .09));
  sky.addColorStop(1, 'rgba(7, 9, 20, 0)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  const base = ctx.createLinearGradient(0, h * .58, 0, h);
  base.addColorStop(0, 'rgba(10, 8, 18, 0)');
  base.addColorStop(1, withAlpha(colors.deep, .66));
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, w, h);
  if (grade === 'noir') {
    ctx.fillStyle = 'rgba(12, 15, 23, .42)';
    ctx.fillRect(0, 0, w, h);
  }
  const edge = ctx.createRadialGradient(w * .5, h * .44, Math.min(w, h) * .12, w * .5, h * .45, Math.max(w, h) * .75);
  edge.addColorStop(0, 'rgba(0, 0, 0, 0)');
  edge.addColorStop(1, 'rgba(9, 7, 19, .55)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, w, h);
}

function fitText(ctx, text, maxWidth, startSize, minSize = 20) {
  let size = startSize;
  do {
    ctx.font = `900 ${size}px "Anton", Impact, "Arial Narrow", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  } while (size >= minSize);
  return size;
}

function drawCoverType(ctx, w, h, title, subtitle, options, colors) {
  const top = options.position === 'top';
  const bandY = top ? 0 : h * .685;
  const bandH = h * .315;
  const shade = ctx.createLinearGradient(0, top ? bandH : bandY, 0, top ? 0 : h);
  shade.addColorStop(0, 'rgba(10, 7, 20, 0)');
  shade.addColorStop(.34, 'rgba(11, 7, 19, .70)');
  shade.addColorStop(1, 'rgba(8, 7, 16, .96)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, bandY, w, bandH);

  const margin = w * .065;
  const kickerY = top ? h * .066 : h * .735;
  ctx.save();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.max(12, h * .017)}px system-ui, sans-serif`;
  ctx.fillStyle = colors.accent;
  ctx.letterSpacing = `${Math.max(2, w * .004)}px`;
  ctx.fillText('VICE CITY   /   305 AFTER DARK', margin, kickerY);
  ctx.letterSpacing = '0px';
  const cleanedTitle = (title || 'AFTER HOURS').trim().toUpperCase();
  const titleY = top ? h * .20 : h * .855;
  const initial = h * Math.max(.14, Number(options.typeSize || 124) / 900);
  const size = fitText(ctx, cleanedTitle, w * .88 / .78, initial, h * .045);
  ctx.save();
  ctx.translate(margin / .78, titleY);
  ctx.transform(.78, 0, -.035, 1, 0, 0);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${size}px "Anton", Impact, "Arial Narrow", sans-serif`;
  ctx.shadowColor = 'rgba(0,0,0,.72)';
  ctx.shadowBlur = size * .20;
  ctx.shadowOffsetX = size * .055;
  ctx.shadowOffsetY = size * .075;
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * .055;
  ctx.strokeStyle = '#170e25';
  ctx.strokeText(cleanedTitle, 0, 0, w * .88 / .78);
  ctx.lineWidth = Math.max(1.5, size * .009);
  ctx.strokeStyle = colors.accent;
  ctx.fillStyle = '#fff9ee';
  ctx.fillText(cleanedTitle, 0, 0, w * .88 / .78);
  ctx.restore();

  const sub = (subtitle || '').trim().toUpperCase();
  if (sub) {
    const subY = top ? h * .29 : h * .927;
    ctx.font = `700 ${Math.max(13, h * .021)}px system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,248,241,.94)';
    ctx.letterSpacing = `${Math.max(1, w * .002)}px`;
    ctx.fillText(sub.slice(0, 44), margin, subY);
    ctx.letterSpacing = '0px';
  }
  ctx.textAlign = 'right';
  ctx.font = `700 ${Math.max(11, h * .015)}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,.72)';
  ctx.fillText('A STORY IN FOUR FRAMES', w - margin, top ? h * .066 : h * .968);
  ctx.restore();
}

/** Paints the full-resolution cover from panel crops, a canvas-native grade, and original poster lettering. */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const { width: w, height: h } = canvas;
  const colors = GRADES[state.grade] ?? GRADES.sunset;
  const panels = panelPolygons(state.layout, w, h);
  ctx.fillStyle = '#120d20';
  ctx.fillRect(0, 0, w, h);
  panels.forEach((panel, index) => {
    const path = pathFrom(ctx, panel);
    ctx.save();
    ctx.clip(path);
    if (state.grade === 'noir') ctx.filter = 'grayscale(1) contrast(1.22)';
    const item = state.photos[state.assignments[index] ?? index % Math.max(1, state.photos.length)];
    const crop = state.crops?.[index] ?? { zoom: 1, panX: 0, panY: 0 };
    drawPhoto(ctx, item?.image, panel, crop.zoom, crop.panX, crop.panY);
    ctx.filter = 'none';
    drawGrade(ctx, w, h, state.grade);
    ctx.restore();
  });

  if (state.layout === 'poster') {
    ctx.fillStyle = 'rgba(12, 7, 20, .18)';
    ctx.fillRect(0, 0, w, h);
  }
  // Crooked cream dividers and a fine inset keyline make the collage read as one printed cover.
  ctx.save();
  ctx.lineJoin = 'bevel';
  ctx.lineWidth = Math.max(4, w * .009);
  ctx.strokeStyle = '#fff4e4';
  ctx.shadowColor = 'rgba(12, 6, 18, .45)';
  ctx.shadowBlur = w * .014;
  panels.forEach(panel => ctx.stroke(pathFrom(ctx, panel)));
  ctx.restore();

  if (state.layout !== 'poster') {
    panels.forEach((panel, index) => {
      const [x, y] = panel[0];
      if (index === 0) return;
      ctx.save();
      ctx.fillStyle = 'rgba(12, 9, 20, .58)';
      ctx.fillRect(x + w * .024, y + h * .023, w * .18, h * .035);
      ctx.font = `700 ${Math.max(11, h * .013)}px system-ui, sans-serif`;
      ctx.fillStyle = '#fff8ed';
      ctx.textBaseline = 'middle';
      ctx.fillText(PANEL_NAMES[index] ?? 'DETAIL / 05', x + w * .035, y + h * .041);
      ctx.restore();
    });
  }

  drawCoverType(ctx, w, h, state.title, state.subtitle, state, colors);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,244,224,.82)';
  ctx.lineWidth = Math.max(1.5, w * .0015);
  ctx.strokeRect(w * .018, h * .018, w * .964, h * .964);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(w * .018, h * .018, w * .115, Math.max(3, h * .006));
  ctx.restore();
  canvas.__panelPaths = panels.map(panel => pathFrom(ctx, panel));
  return panels.length;
}

export const gradePalette = GRADES;
