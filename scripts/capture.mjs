import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_BIN ?? '/home/hatch/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const port = Number(process.env.CDP_PORT ?? 9222);
const child = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', `--remote-debugging-port=${port}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=/tmp/vice-cover-studio-chrome-${port}`, 'about:blank'], { stdio: 'ignore' });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;

try {
  for (let attempt = 0; attempt < 80; attempt++) {
    try { browser = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break; } catch { await pause(250); }
  }
  if (!browser) throw new Error('Chromium remote debugging did not start');
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let commandId = 0;
  const pending = new Map();
  const problems = [];
  ws.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id) {
      const item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id);
      message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
      return;
    }
    if (message.method === 'Runtime.exceptionThrown') problems.push(`exception: ${message.params.exceptionDetails.text}`);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') problems.push(`console: ${message.params.entry.text}`);
    if (message.method === 'Network.loadingFailed') problems.push(`network: ${message.params.errorText}`);
    if (message.method === 'Network.requestWillBeSent') {
      const url = message.params.request.url;
      if (!url.startsWith('http://127.0.0.1:8080/') && !url.startsWith('data:')) problems.push(`external request: ${url}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId; pending.set(id, { resolve, reject }); ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable');
  await mkdir('screenshots', { recursive: true });
  const scenes = [
    { name: '1-cover.jpg', query: '?shot=cover&layout=classic&size=landscape&photo=boulevard&caption=AFTER%20HOURS&subtitle=MIAMI%20NEVER%20SLEEPS&grade=sunset', width: 1280, height: 720 },
    { name: '2-editor.jpg', query: '?shot=editor&layout=classic&size=landscape&photo=boulevard&caption=BOULEVARD%20QUEEN&subtitle=NO%20SLEEP%20TILL%20SUNRISE&grade=neon', width: 1280, height: 720 },
    { name: '3-cover.jpg', query: '?shot=cover&layout=strip&size=portrait&photo=boulevard&caption=VICE%20ON%20FIRE&subtitle=THE%20NIGHT%20IS%20YOURS&grade=vice&position=top', width: 1024, height: 1280 },
    { name: '4-cover.jpg', query: '?shot=cover&layout=poster&size=square&photo=boulevard&caption=NO%20SAINTS&subtitle=JUST%20CITY%20LIGHTS&grade=noir', width: 1024, height: 1024 },
  ];
  for (const scene of scenes) {
    problems.length = 0;
    await send('Page.setDeviceMetricsOverride', { width: scene.width, height: scene.height, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://127.0.0.1:8080/${scene.query}` });
    let ready = false;
    for (let attempt = 0; attempt < 120; attempt++) {
      const result = await send('Runtime.evaluate', { expression: 'window.__shotReady === true', returnByValue: true });
      if (result.result.value) { ready = true; break; }
      await pause(100);
    }
    if (!ready) {
      const details = await send('Runtime.evaluate', { expression: '({title:document.title,status:document.getElementById("status")?.textContent,body:document.body.innerText.slice(0,300)})', returnByValue: true });
      throw new Error(`${scene.name}: scene not ready: ${JSON.stringify(details.result.value)} ${problems.join('; ')}`);
    }
    await pause(100);
    const png = await send('Runtime.evaluate', { expression: `(()=>{const canvas=document.getElementById('cover');const encoded=canvas.toDataURL('image/png');const raw=atob(encoded.split(',')[1]);return {header:encoded.slice(0,30),signature:Array.from({length:8},(_,i)=>raw.charCodeAt(i)),bytes:raw.length,width:canvas.width,height:canvas.height}})()`, returnByValue: true });
    const signature = [137, 80, 78, 71, 13, 10, 26, 10];
    if (!png.result.value.header.startsWith('data:image/png;base64,') || png.result.value.bytes < 1000 || signature.some((byte, index) => png.result.value.signature[index] !== byte)) throw new Error(`${scene.name}: PNG export path failed ${JSON.stringify(png.result.value)}`);
    const image = await send('Page.captureScreenshot', { format: 'jpeg', quality: 82, fromSurface: true, captureBeyondViewport: false });
    await writeFile(`screenshots/${scene.name}`, Buffer.from(image.data, 'base64'));
    if (problems.length) throw new Error(`${scene.name}: ${problems.join('; ')}`);
    console.log(`${scene.name}: ${scene.width}x${scene.height}, canvas PNG ${png.result.value.width}x${png.result.value.height} (${png.result.value.bytes} bytes), no browser errors`);
  }
  ws.close();
} finally {
  child.kill('SIGTERM');
}
