/** Configures deterministic, judge-friendly cover and editor scenes for screenshot capture. */
export async function runShot(shot, query, load) {
  const photo = query.get('photo') === 'boulevard' ? './samples/boulevard.jpg' : './samples/pier.jpg';
  const caption = query.get('caption') || (shot === 'editor' ? 'BOULEVARD QUEEN' : 'AFTER HOURS');
  const layout = query.get('layout') || (shot === 'editor' ? 'classic' : 'classic');
  const size = query.get('size') || 'landscape';
  document.body.dataset.shot = shot;
  document.body.dataset.size = size;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  if (shot === 'editor') document.body.classList.add('shot-editor');
  await load(photo, caption, { layout, grade: query.get('grade') || (shot === 'editor' ? 'neon' : 'sunset'), subtitle: query.get('subtitle') || 'MIAMI NEVER SLEEPS', name: query.get('photo') || 'Sample', size, position: query.get('position') || 'bottom' });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
