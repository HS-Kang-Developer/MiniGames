// Run after the production build: node tests/puzzle-arena-browser.cjs
// Uses Node 22+ built-ins and an installed Chrome/Chromium; no new dependencies.
// Set PUZZLE_BROWSER to the browser executable if it is not in a standard location.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const build = path.join(root, 'dist');
const candidates = [
  process.env.PUZZLE_BROWSER,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const executable = candidates.find(candidate => fs.existsSync(candidate));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  assert.ok(executable, 'Install Chrome/Chromium or set PUZZLE_BROWSER');
  assert.ok(fs.existsSync(path.join(build, 'puzzle-arena/index.html')), 'Run the production build first');
  const artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'puzzle-arena-browser-'));
  const profile = path.join(artifacts, 'profile');
  const server = spawn(process.execPath, [path.join(root, 'scripts/preview.cjs')], {
    cwd: root, env: { ...process.env, PORT: '0' }, windowsHide: true, stdio: ['ignore', 'pipe', 'inherit'],
  });
  const base = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => { server.kill(); reject(new Error('Preview did not become ready')); }, 10000);
    server.on('error', error => { clearTimeout(timer); reject(error); });
    server.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
      if (match) { clearTimeout(timer); resolve(match[0]); }
    });
  });
  let browser;
  let socket;
  const pending = new Map();
  try {
    browser = spawn(executable, [
      '--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + profile,
      '--no-first-run', '--no-default-browser-check', '--disable-background-networking', 'about:blank',
    ], { windowsHide: true, stdio: 'ignore' });
    let launchError;
    browser.on('error', error => { launchError = error; });
    const portFile = path.join(profile, 'DevToolsActivePort');
    for (let attempt = 0; !fs.existsSync(portFile) && attempt < 300; attempt++) {
      if (launchError) throw launchError;
      if (browser.exitCode !== null) throw new Error('Browser exited: ' + browser.exitCode);
      await delay(50);
    }
    assert.ok(fs.existsSync(portFile), 'Browser debugging port did not become ready');
    const port = Number(fs.readFileSync(portFile, 'utf8').split('\n')[0]);
    const pages = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    socket = new WebSocket(pages.find(page => page.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    const exceptions = [];
    socket.addEventListener('message', event => {
      const message = JSON.parse(event.data);
      if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
      if (!message.id) return;
      const entry = pending.get(message.id);
      if (!entry) return;
      pending.delete(message.id);
      clearTimeout(entry.timer);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
    let commandId = 0;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++commandId;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error('Timed out: ' + method)); }, 10000);
      pending.set(id, { resolve, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    const click = selector => evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
    const frame = () => evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const setAnswer = value => evaluate('document.querySelector("#answer-input").value = ' + JSON.stringify(String(value)));
    const checkLayout = async () => assert.ok(
      await evaluate('document.documentElement.scrollWidth <= window.innerWidth'),
      'The viewport must not overflow horizontally'
    );
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.navigate', { url: base + '/MiniGames/tests/puzzle-arena.html' });
    let regression;
    for (let attempt = 0; attempt < 400; attempt++) {
      regression = await evaluate('window.__puzzleTests || null');
      if (regression?.done) break;
      await delay(25);
    }
    assert.ok(regression?.done, 'Browser regression suite did not finish');
    assert.equal(regression.total, 20);
    assert.equal(regression.passed, regression.total, JSON.stringify(regression.results.filter(result => !result.passed)));
    console.log('PASS browser regression suite: ' + regression.passed + '/' + regression.total);
    for (const device of [
      { name: 'desktop-mouse', width: 1280, height: 900, mobile: false },
      { name: 'mobile-touch', width: 390, height: 844, mobile: true },
    ]) {
      await send('Emulation.setDeviceMetricsOverride', { width: device.width, height: device.height, deviceScaleFactor: 1, mobile: device.mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: device.mobile, maxTouchPoints: 1 });
      for (const language of ['ko', 'ja']) {
        const label = device.name + '-' + language;
        const url = base + '/MiniGames/puzzle-arena/?scenario=' + label;
        await send('Page.navigate', { url });
        let ready = false;
        for (let attempt = 0; attempt < 200; attempt++) {
          ready = await evaluate('location.href === ' + JSON.stringify(url) + ' && document.readyState === "complete" && !!document.querySelector("#open-squares")');
          if (ready) break;
          await delay(25);
        }
        assert.ok(ready, 'Game did not load');
        await click('#language-' + language);
        await click('#open-squares');
        await frame();
        const puzzle = await evaluate('JSON.stringify({ currentBoard, currentAnswer, puzzleNumber, records })');
        const answer = await evaluate('currentAnswer');
        await setAnswer(answer + 1);
        await click('#submit-answer');
        assert.equal(await evaluate('document.querySelector("#answer-feedback").textContent'), language === 'ko' ? '오답입니다.' : '不正解です。');
        assert.equal(await evaluate('document.querySelector("#answer-input").disabled'), false);
        assert.equal(await evaluate('document.querySelector("#next-puzzle").hidden'), true);
        assert.equal(await evaluate('JSON.stringify({ currentBoard, currentAnswer, puzzleNumber, records })'), puzzle);
        await click('#give-up');
        assert.equal(await evaluate('document.querySelector("#answer-input").disabled'), true);
        assert.equal(await evaluate('document.querySelector("#solution-panel").hidden'), false);
        assert.equal(await evaluate('document.querySelector("#solution-list").children.length'), answer);
        await evaluate('document.querySelector("#solution-list button").click()');
        assert.ok(await evaluate('document.querySelectorAll(".solution-cell").length > 0'));
        await checkLayout();
        let screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(path.join(artifacts, label + '-squares.png'), Buffer.from(screenshot.data, 'base64'));
        const number = await evaluate('puzzleNumber');
        await click('#next-puzzle');
        assert.equal(await evaluate('puzzleNumber'), number + 1);
        assert.equal(await evaluate('document.querySelector("#solution-panel").hidden'), true);
        await setAnswer(await evaluate('currentAnswer'));
        await click('#submit-answer');
        assert.equal(await evaluate('records.history[0].correct'), true);
        await click('#back-home');
        await click('#open-cubes');
        await click('#show-hint');
        await click('#show-columns');
        await setAnswer(12);
        await evaluate('document.querySelector("#board").scrollIntoView({ block: "center", behavior: "instant" })');
        await frame();
        const before = await evaluate('JSON.stringify({ currentBoard, currentAnswer, currentHint, puzzleNumber, records })');
        const geometry = await evaluate('document.querySelector("#board").innerHTML');
        const initial = await evaluate('({ yaw: cubeYaw, pitch: cubePitch, scroll: scrollY })');
        const rect = await evaluate('(() => { const r = document.querySelector("#board").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; })()');
        const x = rect.x + rect.width / 2 - 30;
        const y = rect.y + rect.height / 2 - 25;
        const move = async (type, px, py) => {
          if (device.mobile) {
            await send('Input.dispatchTouchEvent', {
              type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [{ x: px, y: py, id: 1, radiusX: 5, radiusY: 5 }],
            });
          } else {
            await send('Input.dispatchMouseEvent', {
              type, x: px, y: py, button: type === 'mouseMoved' ? 'none' : 'left',
              buttons: type === 'mouseReleased' ? 0 : 1, clickCount: type === 'mouseMoved' ? 0 : 1,
            });
          }
        };
        await move(device.mobile ? 'touchStart' : 'mousePressed', x, y);
        for (let step = 1; step <= 6; step++) {
          await move(device.mobile ? 'touchMove' : 'mouseMoved', x + step * 12, y + step * 6);
        }
        // Mouse capture must also keep working after the pointer leaves the SVG.
        if (!device.mobile) await move('mouseMoved', rect.x + rect.width + 15, y + 50);
        await move(device.mobile ? 'touchEnd' : 'mouseReleased', x + 72, y + 36);
        await frame();
        assert.notEqual(await evaluate('cubeYaw'), initial.yaw);
        assert.notEqual(await evaluate('cubePitch'), initial.pitch);
        assert.notEqual(await evaluate('document.querySelector("#board").innerHTML'), geometry);
        assert.equal(await evaluate('cubeDrag'), null);
        assert.equal(await evaluate('document.querySelector("#board").classList.contains("dragging")'), false);
        assert.equal(await evaluate('scrollY'), initial.scroll, 'Dragging must not scroll the page');
        assert.equal(await evaluate('getComputedStyle(document.querySelector("#board")).touchAction'), 'none');
        assert.equal(await evaluate('JSON.stringify({ currentBoard, currentAnswer, currentHint, puzzleNumber, records })'), before);
        assert.deepEqual(await evaluate('Array.from(document.querySelector("#column-view").children, cell => Number(cell.textContent))'), await evaluate('currentBoard.flat()'));
        const view = await evaluate('JSON.stringify({ cubeYaw, cubePitch })');
        await click('#language-' + (language === 'ko' ? 'ja' : 'ko'));
        assert.equal(await evaluate('JSON.stringify({ cubeYaw, cubePitch })'), view);
        assert.equal(await evaluate('document.querySelector("#answer-input").value'), '12');
        assert.equal(await evaluate('document.querySelector("#hint-box").hidden'), false);
        assert.equal(await evaluate('document.querySelector("#column-view").hidden'), false);
        await click('#reset-cube-view');
        await frame();
        assert.equal(await evaluate('document.querySelector("#board").innerHTML'), geometry);
        await checkLayout();
        screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
        fs.writeFileSync(path.join(artifacts, label + '-cubes.png'), Buffer.from(screenshot.data, 'base64'));
        // Cancellation must release capture and allow a fresh drag.
        if (device.mobile) {
          await move('touchStart', x, y);
          await move('touchMove', x + 12, y + 8);
          await move('touchCancel', x + 12, y + 8);
          await frame();
          assert.equal(await evaluate('cubeDrag'), null);
        }
        await setAnswer(await evaluate('currentAnswer'));
        await click('#submit-answer');
        assert.equal(await evaluate('document.querySelector("#solution-list").children.length'), await evaluate('currentBoard.length'));
        const stored = await evaluate('localStorage.getItem(STORAGE_KEY)');
        await send('Page.reload');
        for (let attempt = 0; attempt < 200; attempt++) {
          if (await evaluate('document.readyState === "complete" && !!document.querySelector("#open-cubes")')) break;
          await delay(25);
        }
        assert.equal(await evaluate('localStorage.getItem(STORAGE_KEY)'), stored);
        assert.equal(await evaluate('document.querySelector("#back-blog").getAttribute("href")'), '../../#/');
        console.log('PASS ' + label + ': retry, give up, solution, drag, locale, records, layout');
      }
    }
    assert.deepEqual(exceptions, [], 'No browser JavaScript exceptions');
    console.log('PASS 4/4 Chrome scenarios; screenshots: ' + artifacts);
    await send('Browser.close').catch(() => {});
  } finally {
    for (const entry of pending.values()) clearTimeout(entry.timer);
    socket?.close();
    if (browser && browser.exitCode === null) browser.kill();
    if (server.exitCode === null) {
      await new Promise(resolve => { server.once('exit', resolve); server.kill(); });
    }
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
