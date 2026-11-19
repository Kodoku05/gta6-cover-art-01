import { drawCover } from './cover.js';
import { runShot } from './shots.js';

const $ = (id) => document.getElementById(id);
const canvas = $('cover');
const title = $('title');
const subtitle = $('subtitle');
const status = $('status');
const state = {
  layout: 'classic', grade: 'sunset', title: title.value, subtitle: subtitle.value,
  position: 'bottom', typeSize: 124, activePanel: 0, photos: [], assignments: [0, 1, 0, 1],
  crops: Array.from({ length: 4 }, () => ({ zoom: 1, panX: 0, panY: 0 })),
};

export function loadImage(url) {
  return new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
}

function defaultPhoto(url, name) {
  return loadImage(url).then(image => ({ image, name, zoom: 1, panX: 0, panY: 0 }));
}

function refreshAssign() {
  const select = $('assign');
  select.innerHTML = state.photos.map((photo, i) => `<option value="${i}">${String(i + 1).padStart(2, '0')} · ${photo.name}</option>`).join('');
  select.value = state.assignments[state.activePanel] ?? 0;
  $('active-label').textContent = String(state.activePanel + 1).padStart(2, '0');
  const panelTotal = state.layout === 'poster' ? 1 : 4;
  $('panel-count').textContent = `${String(state.activePanel + 1).padStart(2, '0')} — ${String(panelTotal).padStart(2, '0')}`;
  $('photo-count').textContent = `${state.photos.length} loaded`;
  const crop = state.crops[state.activePanel];
  $('zoom').value = Math.round((crop?.zoom ?? 1) * 100);
  $('zoom-label').textContent = `${(crop?.zoom ?? 1).toFixed(1)}×`;
}

function paint() { drawCover(canvas, state); refreshAssign(); }

function setOutputSize(value) {
  const [width, height] = SIZES[value] ?? SIZES.landscape;
  canvas.width = width; canvas.height = height;
  $('format-preview').innerHTML = `<span>${width}</span><i style="aspect-ratio:${width}/${height}"></i><span>${height}</span>`;
  if (document.body.classList.contains('shot-cover')) fitCoverCanvas();
}

function fitCoverCanvas() {
  const scale = Math.min(innerWidth / canvas.width, innerHeight / canvas.height);
  canvas.style.width = `${Math.round(canvas.width * scale)}px`;
  canvas.style.height = `${Math.round(canvas.height * scale)}px`;
}

function setSelected(container, attr, value) {
  container.querySelectorAll('button').forEach(button => button.classList.toggle('selected', button.dataset[attr] === value));
}

function addPhotos(files) {
  const additions = [...files].map(file => new Promise((resolve, reject) => {
    const image = new Image(); image.onload = () => resolve({ image, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18), zoom: 1, panX: 0, panY: 0 }); image.onerror = reject; image.src = URL.createObjectURL(file);
  }));
  Promise.all(additions).then(items => { state.photos.push(...items); if (state.photos.length === items.length) state.assignments = [0, 1, 0, 1]; refreshAssign(); paint(); });
}

function panelFromPointer(event) {
  const box = canvas.getBoundingClientRect();
  const x = (event.clientX - box.left) * canvas.width / box.width;
  const y = (event.clientY - box.top) * canvas.height / box.height;
  if (state.layout === 'poster') return 0;
  if (state.layout === 'strip') return y > canvas.height * .74 ? Math.min(2, Math.floor(x / (canvas.width / 3))) + 1 : 0;
  if (x < canvas.width * .56 && y < canvas.height * .72) return 0;
  if (x > canvas.width * .56 && y < canvas.height * .45) return 1;
  if (x > canvas.width * .52 && y < canvas.height * .85) return 2;
  return 3;
}

function wire() {
  $('photos').addEventListener('change', event => addPhotos(event.target.files));
  $('fill-all').addEventListener('click', () => { state.assignments = state.assignments.map(() => 0); paint(); });
  $('assign').addEventListener('change', event => { state.assignments[state.activePanel] = Number(event.target.value); paint(); });
  canvas.addEventListener('pointerdown', event => { state.activePanel = panelFromPointer(event); canvas.setPointerCapture(event.pointerId); state.dragging = true; refreshAssign(); });
  canvas.addEventListener('pointerup', () => { state.dragging = false; });
  canvas.addEventListener('pointermove', event => {
    if (!state.dragging || !event.buttons || !state.photos.length) return;
    const photo = state.photos[state.assignments[state.activePanel]]; if (!photo) return;
    const crop = state.crops[state.activePanel];
    crop.panX += event.movementX * 2.2; crop.panY += event.movementY * 2.2; paint();
  });
  $('zoom').addEventListener('input', event => { state.crops[state.activePanel].zoom = Number(event.target.value) / 100; $('zoom-label').textContent = `${(Number(event.target.value) / 100).toFixed(1)}×`; paint(); });
  $('title').addEventListener('input', event => { state.title = event.target.value; paint(); });
  $('subtitle').addEventListener('input', event => { state.subtitle = event.target.value; paint(); });
  $('type-size').addEventListener('input', event => { state.typeSize = Number(event.target.value); paint(); });
  $('layouts').addEventListener('click', event => { const button = event.target.closest('button'); if (!button) return; state.layout = button.dataset.layout; if (state.layout === 'poster') state.activePanel = 0; setSelected($('layouts'), 'layout', state.layout); paint(); });
  $('grades').addEventListener('click', event => { const button = event.target.closest('button'); if (!button) return; state.grade = button.dataset.grade; setSelected($('grades'), 'grade', state.grade); paint(); });
  $('caption-position').addEventListener('click', event => { const button = event.target.closest('button'); if (!button) return; state.position = button.dataset.position; setSelected($('caption-position'), 'position', state.position); paint(); });
  $('size').addEventListener('change', event => { setOutputSize(event.target.value); paint(); });
  $('export').addEventListener('click', exportPng);
}

const SIZES = { square: [1080, 1080], portrait: [1080, 1350], landscape: [1920, 1080] };

function exportPng() {
  const [w, h] = SIZES[$('size').value];
  const output = document.createElement('canvas'); output.width = w; output.height = h;
  drawCover(output, state);
  output.toBlob(blob => {
    const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(blob); anchor.download = `vice-cover-${w}x${h}.png`; anchor.click();
    status.textContent = `Exported ${w} × ${h} PNG`;
  }, 'image/png');
}

async function boot() {
  try {
    state.photos = await Promise.all([defaultPhoto('./samples/boulevard.jpg', 'Boulevard'), defaultPhoto('./samples/pier.jpg', 'Pier')]);
    wire(); setOutputSize($('size').value); paint();
    const shot = new URLSearchParams(location.search).get('shot');
    if (shot) await runShot(shot, new URLSearchParams(location.search), async (sample, text, config = {}) => { state.photos = [await defaultPhoto(sample, config.name ?? 'Sample'), await defaultPhoto('./samples/pier.jpg', 'Pier')]; state.title = text; title.value = text; if (config.layout) { state.layout = config.layout; setSelected($('layouts'), 'layout', state.layout); } if (config.grade) { state.grade = config.grade; setSelected($('grades'), 'grade', state.grade); } if (config.position) { state.position = config.position; setSelected($('caption-position'), 'position', state.position); } if (config.subtitle) { state.subtitle = config.subtitle; subtitle.value = config.subtitle; } if (config.size) { $('size').value = config.size; setOutputSize(config.size); } paint(); });
    window.addEventListener('resize', () => { if (document.body.classList.contains('shot-cover')) fitCoverCanvas(); });
  } catch (error) { status.textContent = `Sample photos unavailable: ${error.message}`; console.error(error); }
}

boot();
