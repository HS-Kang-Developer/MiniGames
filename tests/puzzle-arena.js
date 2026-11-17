// Browser-native regression tests: no jsdom or additional test dependency.
const tests = [];
const test = (name, run) => tests.push({ name, run });
const normalize = value => value && typeof value === 'object'
  ? (Array.isArray(value) ? value.map(normalize) : Object.fromEntries(Object.keys(value).sort().map(key => [key, normalize(value[key])])))
  : value;
const assert = {
  equal(actual, expected) { if (!Object.is(actual, expected)) throw new Error('Expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual)); },
  notEqual(actual, expected) { if (Object.is(actual, expected)) throw new Error('Unexpected equal values'); },
  deepEqual(actual, expected) { this.equal(JSON.stringify(normalize(actual)), JSON.stringify(normalize(expected))); },
  ok(value) { if (!value) throw new Error('Expected a truthy value'); },
  match(value, pattern) { if (!pattern.test(value)) throw new Error('Unexpected value: ' + value); },
};
const gameBase = new URL('../puzzle-arena/', location.href);
const recordsKey = 'akmaui-game-records-v1';
const languageKey = 'akmaui-game-language-v1';
let html;
let script;
let cssText;
const postcss = {
  parse(text) {
    const element = document.createElement('style');
    element.textContent = text;
    document.head.append(element);
    const selectors = text => {
      let depth = 0, start = 0;
      const result = [];
      for (let i = 0; i < text.length; i++) {
        if ('(['.includes(text[i])) depth++;
        if (')]'.includes(text[i])) depth--;
        if (text[i] === ',' && depth === 0) { result.push(text.slice(start, i).trim()); start = i + 1; }
      }
      result.push(text.slice(start).trim());
      return result;
    };
    const walk = (rules, callback, atRules) => {
      for (const rule of rules) {
        if (rule.selectorText && !atRules) callback({ selectors: selectors(rule.selectorText) });
        if (!rule.selectorText && atRules) callback({ name: rule.cssText.match(/^@([-\w]+)/)?.[1] });
        if (rule.cssRules) walk(rule.cssRules, callback, atRules);
      }
    };
    return {
      walkRules(callback) { walk(element.sheet.cssRules, callback, false); },
      walkAtRules(callback) { try { walk(element.sheet.cssRules, callback, true); } finally { element.remove(); } },
    };
  },
};

const legacyRecords = {
  played: 8, correct: 6, currentStreak: 2, bestStreak: 4,
  history: [
    { timestamp: '2026-02-16T04:00:00.000Z', game: 'cubes', size: 3, target: null, answer: 20, solution: 20, correct: true, hintUsed: true },
    { date: '2/15 12:00', size: 4, target: 12, answer: 3, solution: 3, correct: true, hintUsed: false },
  ],
};

async function withGame(callback, { language = 'ko', blogLanguage, blockedStorage = false, records = legacyRecords } = {}) {
  const frame = document.createElement('iframe');
  frame.title = 'Isolated game fixture';
  frame.style.cssText = 'position:absolute;left:-10000px;top:0;width:1280px;height:1000px;border:0';
  const options = { language, blogLanguage, blockedStorage, records };
  const prelude = '(' + function (options) {
    window.__scrolls = [];
    window.scrollTo = value => window.__scrolls.push(value);
    window.matchMedia = () => ({ matches: true });
    if (options.blockedStorage) {
      Object.defineProperty(window, 'localStorage', { get() { throw new Error('Storage disabled'); } });
    } else {
      localStorage.setItem('akmaui-game-records-v1', JSON.stringify(options.records, null, 2));
      for (const key of ['akmaui-game-language-v1', 'i18nextLng']) localStorage.removeItem(key);
      if (options.language) localStorage.setItem('akmaui-game-language-v1', options.language);
      if (options.blogLanguage) localStorage.setItem('i18nextLng', options.blogLanguage);
    }
  }.toString() + ')(' + JSON.stringify(options) + ')';
  const loaded = new Promise((resolve, reject) => {
    frame.onload = resolve;
    frame.onerror = () => reject(new Error('Game fixture did not load'));
  });
  frame.srcdoc = html.replace('<head>', '<head><base href="' + gameBase.href + '"><script>' + prelude + '</script>');
  document.body.append(frame);
  try {
    await loaded;
    const window = frame.contentWindow;
    const frames = new Map();
    let frameId = 0;
    window.requestAnimationFrame = callback => { frames.set(++frameId, callback); return frameId; };
    window.cancelAnimationFrame = id => frames.delete(id);
    const flushFrames = () => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach(callback => callback());
    };
    const board = window.document.querySelector('#board');
    const captures = new Set();
    board.setPointerCapture = id => captures.add(id);
    board.hasPointerCapture = id => captures.has(id);
    board.releasePointerCapture = id => captures.delete(id);
    const pointer = (type, values = {}) => {
      const { pointerId = 1, pointerType = 'mouse', isPrimary = true, ...mouse } = values;
      const event = new window.MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...mouse });
      Object.defineProperties(event, {
        pointerId: { value: pointerId }, pointerType: { value: pointerType }, isPrimary: { value: isPrimary },
      });
      board.dispatchEvent(event);
      return event;
    };
    const evaluate = source => window.eval(source);
    const value = source => JSON.parse(evaluate('JSON.stringify(' + source + ')'));
    await callback({
      window, query: selector => window.document.querySelector(selector), evaluate, value,
      originalStorage: JSON.stringify(records, null, 2), scrolls: window.__scrolls, pointer, flushFrames,
    });
  } finally { frame.remove(); }
}

// Deliberately counts every cell of every rectangle, independently of the game's
// optimized column-sum implementation.
function countRectangles(board, target) {
  let count = 0;
  for (let top = 0; top < board.length; top++) {
    for (let left = 0; left < board.length; left++) {
      for (let bottom = top; bottom < board.length; bottom++) {
        for (let right = left; right < board.length; right++) {
          let sum = 0;
          for (let row = top; row <= bottom; row++) {
            for (let column = left; column <= right; column++) sum += board[row][column] ?? 0;
          }
          if (sum === target) count++;
        }
      }
    }
  }
  return count;
}

test('existing counts, streaks, old-format history and storage bytes survive initialization', async () => {
  await withGame(({ query, value, window, originalStorage }) => {
    assert.deepEqual(value('records'), legacyRecords);
    assert.equal(query('#stat-played').textContent, '8');
    assert.equal(query('#stat-best-streak').textContent, '4');
    assert.equal(query('#stat-accuracy').textContent, '75');
    assert.equal(query('#history-list').children.length, 2);
    assert.equal(window.localStorage.getItem(recordsKey), originalStorage);
    query('#language-ja').click();
    assert.equal(window.localStorage.getItem(recordsKey), originalStorage);
    assert.match(query('#history-list').textContent, /キューブ/);
  });
});

test('squares: every board size, correct answer, hint, duplicate submit and record preservation', async () => {
  await withGame(({ query, window, value, evaluate, scrolls }) => {
    query('#open-squares').click();
    assert.equal(query('#game-screen').hidden, false);
    assert.equal(window.document.activeElement.id, 'game-title');
    assert.equal(scrolls.at(-1).behavior, 'auto');
    for (const size of [4, 5, 6]) {
      query('#board-size').value = String(size);
      query('#board-size').dispatchEvent(new window.Event('change'));
      assert.equal(query('#board').children.length, size * size);
      assert.equal(query('#show-hint').getAttribute('aria-expanded'), 'false');
      const board = value('currentBoard');
      const target = Number(query('#target-number').textContent);
      const answer = countRectangles(board, target);
      assert.equal(value('currentAnswer'), answer);
      query('#show-hint').click();
      assert.equal(query('#hint-box').hidden, false);
      assert.equal(query('#show-hint').getAttribute('aria-expanded'), 'true');
      const hint = value('currentHint');
      let hintedSum = 0;
      for (let row = hint.top; row <= hint.bottom; row++) {
        for (let column = hint.left; column <= hint.right; column++) hintedSum += board[row][column] ?? 0;
      }
      assert.equal(hintedSum, target);
      query('#answer-input').value = String(answer);
      query('#answer-input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      assert.equal(query('#answer-input').disabled, true);
      assert.equal(query('#next-puzzle').hidden, false);
      const played = value('records.played');
      evaluate('submitAnswer()');
      assert.equal(value('records.played'), played);
      assert.equal(value('records.history[0].hintUsed'), true);
    }
    const stored = JSON.parse(window.localStorage.getItem(recordsKey));
    assert.equal(stored.played, 11);
    assert.equal(stored.correct, 9);
    assert.equal(stored.currentStreak, 5);
    assert.equal(stored.bestStreak, 5);
    assert.deepEqual(stored.history.slice(-2), legacyRecords.history);
  });
});

test('cubes: all sizes, correct totals, hints, wrong answers and next puzzle', async () => {
  await withGame(({ query, window, value }) => {
    query('#open-cubes').click();
    assert.equal(query('.legend').hidden, true);
    assert.deepEqual(Array.from(query('#board-size').options, option => option.value), ['3', '4', '5']);
    for (const size of [3, 4, 5]) {
      query('#board-size').value = String(size);
      query('#board-size').dispatchEvent(new window.Event('change'));
      const board = value('currentBoard');
      const answer = board.flat().reduce((sum, height) => sum + height, 0);
      assert.equal(value('currentAnswer'), answer);
      assert.equal(query('#board').getAttribute('role'), 'img');
      assert.ok(query('#board svg polygon'));
      query('#show-hint').click();
      const highest = Math.max(...board.flat());
      assert.deepEqual(value('currentHint'), { height: highest, count: board.flat().filter(height => height === highest).length });
      query('#answer-input').value = String(answer + 1);
      query('#submit-answer').click();
      assert.equal(value('records.currentStreak'), 0);
      assert.equal(value('records.history[0].correct'), false);
      assert.equal(value('records.history[0].game'), 'cubes');
      assert.equal(value('records.history[0].solution'), answer);
      query('#next-puzzle').click();
      assert.equal(query('#answer-input').disabled, false);
      assert.equal(query('#hint-box').hidden, true);
      query('#answer-input').value = String(value('currentAnswer'));
      query('#submit-answer').click();
      assert.equal(value('records.currentStreak'), 1);
    }
    assert.equal(value('records.played'), 14);
    assert.equal(value('records.correct'), 9);
    assert.equal(value('records.bestStreak'), 4);
  });
});

test('invalid answers never change or overwrite records', async () => {
  await withGame(({ query, window, originalStorage }) => {
    query('#open-squares').click();
    for (const input of ['', '-1', '1.5']) {
      query('#answer-input').value = input;
      query('#submit-answer').click();
      assert.equal(query('#answer-input').disabled, false);
      assert.equal(window.localStorage.getItem(recordsKey), originalStorage);
      assert.match(query('#answer-feedback').className, /error/);
    }
  });
});

test('language switching preserves the active puzzle, entered answer and hint', async () => {
  await withGame(({ query, value, window }) => {
    query('#open-cubes').click();
    query('#show-hint').click();
    query('#answer-input').value = '12';
    const before = value('({ currentBoard, currentAnswer, currentHint, puzzleNumber })');
    query('#language-ja').click();
    assert.equal(window.document.documentElement.lang, 'ja');
    assert.equal(query('#game-title').textContent, 'キューブを数えよう');
    assert.match(query('#rule-tip-text').textContent, /柱/);
    assert.equal(query('#next-label').textContent, '次の問題へ');
    assert.equal(query('#back-blog-label').textContent, 'ブログへ');
    assert.equal(query('#answer-input').value, '12');
    assert.equal(query('#hint-box').hidden, false);
    assert.deepEqual(value('({ currentBoard, currentAnswer, currentHint, puzzleNumber })'), before);
    assert.equal(window.localStorage.getItem(languageKey), 'ja');
    query('#back-home').click();
    assert.equal(window.document.activeElement.id, 'home-title');
    query('#language-ko').click();
    assert.equal(window.document.documentElement.lang, 'ko');
    assert.equal(query('#back-blog-label').textContent, '블로그로');
  });
});

test('saved game language takes precedence; blog language is only an initial fallback', async () => {
  await withGame(({ window }) => assert.equal(window.document.documentElement.lang, 'ja'), { language: 'ja', blogLanguage: 'ko' });
  await withGame(({ query, window }) => {
    assert.equal(window.document.documentElement.lang, 'ja');
    query('#language-ko').click();
    assert.equal(window.localStorage.getItem(languageKey), 'ko');
  }, { language: null, blogLanguage: 'ja-JP' });
});

test('storage disabled: both games and language switching remain playable', async () => {
  await withGame(({ query, value }) => {
    for (const selector of ['#open-squares', '#open-cubes']) {
      query(selector).click();
      query('#language-ja').click();
      query('#answer-input').value = String(value('currentAnswer'));
      query('#submit-answer').click();
      assert.equal(query('#answer-input').disabled, true);
      assert.match(query('#answer-feedback').textContent, /保存/);
      query('#back-home').click();
    }
  }, { blockedStorage: true });
});

test('same-origin reload reads the saved result and language without resetting them', async () => {
  let saved;
  await withGame(({ query, value, window }) => {
    query('#open-cubes').click();
    query('#answer-input').value = String(value('currentAnswer'));
    query('#submit-answer').click();
    saved = JSON.parse(window.localStorage.getItem(recordsKey));
  });
  await withGame(({ query, value }) => {
    assert.deepEqual(value('records'), saved);
    assert.equal(query('#stat-played').textContent, '9');
    assert.equal(query('#stat-current-streak').textContent, '3');
  }, { records: saved, language: 'ja' });
});

test('styles stay scoped, IDs are unique and the blog link resolves to the blog root', async () => {
  const css = postcss.parse(cssText);
  css.walkRules(rule => {
    for (const selector of rule.selectors) assert.match(selector, /^\.devil-game(?:$|[\s:])/);
  });
  css.walkAtRules(rule => assert.notEqual(rule.name, 'import'));
  await withGame(({ window, query }) => {
    const ids = Array.from(window.document.querySelectorAll('[id]'), element => element.id);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(query('#back-blog').href, location.origin + '/#/');
    assert.equal(query('#show-hint').getAttribute('aria-controls'), 'hint-box');
  });
});

for (const language of ['ko', 'ja']) {
  test(`squares (${language}): repeated wrong answers reveal nothing, preserve records, then accept the correct answer once`, async () => {
    await withGame(({ query, value, window, originalStorage }) => {
      query('#open-squares').click();
      const before = value('({ currentBoard, currentAnswer, currentSolutions, puzzleNumber, records })');
      for (const wrong of [before.currentAnswer + 1, before.currentAnswer + 2, before.currentAnswer + 1]) {
        query('#answer-input').value = String(wrong);
        query('#submit-answer').click();
        assert.equal(query('#answer-feedback').textContent, language === 'ko' ? '오답입니다.' : '不正解です。');
        assert.equal(query('#answer-input').disabled, false);
        assert.equal(query('#submit-answer').disabled, false);
        assert.equal(query('#give-up').hidden, false);
        assert.equal(query('#next-puzzle').hidden, true);
        assert.equal(query('#solution-panel').hidden, true);
        assert.equal(query('#solution-list').children.length, 0);
        assert.equal(window.localStorage.getItem(recordsKey), originalStorage);
        assert.deepEqual(value('({ currentBoard, currentAnswer, currentSolutions, puzzleNumber, records })'), before);
      }
      // Even dispatching a hidden Next button cannot skip an unanswered puzzle.
      query('#next-puzzle').dispatchEvent(new window.Event('click'));
      assert.equal(value('puzzleNumber'), before.puzzleNumber);
      query('#answer-input').value = String(before.currentAnswer);
      query('#answer-input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
      assert.equal(value('records.played'), 9);
      assert.equal(value('records.correct'), 7);
      assert.equal(value('records.currentStreak'), 3);
      assert.equal(value('records.history[0].correct'), true);
      query('#submit-answer').click();
      assert.equal(value('records.played'), 9);
      assert.equal(query('#solution-panel').hidden, false);
    }, { language });
  });

  test(`squares (${language}): give up locks input, records once, preserves all solutions and waits for Next`, async () => {
    await withGame(({ query, value, window, evaluate }) => {
      query('#open-squares').click();
      query('#show-hint').click();
      const before = value('({ currentBoard, currentAnswer, currentSolutions, currentHint, puzzleNumber })');
      query('#answer-input').value = String(before.currentAnswer + 1);
      query('#submit-answer').click();
      query('#give-up').click();
      assert.equal(query('#answer-input').disabled, true);
      assert.equal(query('#submit-answer').disabled, true);
      assert.equal(query('#give-up').hidden, true);
      assert.equal(query('#new-puzzle').disabled, true);
      assert.equal(query('#board-size').disabled, true);
      assert.equal(query('#next-puzzle').hidden, false);
      assert.equal(window.document.activeElement.id, 'next-puzzle');
      assert.equal(query('#solution-panel').hidden, false);
      assert.equal(query('#solution-list').children.length, before.currentAnswer);
      assert.ok(query('#solution-summary').textContent.includes(String(before.currentAnswer)));
      assert.equal(value('records.played'), 9);
      assert.equal(value('records.correct'), 6);
      assert.equal(value('records.currentStreak'), 0);
      assert.equal(value('records.history[0].correct'), false);
      assert.equal(value('records.history[0].hintUsed'), true);
      assert.deepEqual(value('records.history.slice(-2)'), legacyRecords.history);
      const stored = window.localStorage.getItem(recordsKey);
      evaluate('giveUp(); submitAnswer();');
      query('#answer-input').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }));
      assert.equal(window.localStorage.getItem(recordsKey), stored);
      before.currentSolutions.forEach((solution, index) => {
        const button = query('#solution-list').children[index].firstElementChild;
        button.click();
        assert.equal(button.getAttribute('aria-pressed'), 'true');
        const highlighted = Array.from(window.document.querySelectorAll('.solution-cell'));
        assert.equal(highlighted.length, (solution.bottom - solution.top + 1) * (solution.right - solution.left + 1));
        assert.equal(highlighted.reduce((sum, cell) => sum + Number(cell.textContent), 0), Number(query('#target-number').textContent));
      });
      query(language === 'ko' ? '#language-ja' : '#language-ko').click();
      assert.deepEqual(value('({ currentBoard, currentAnswer, currentSolutions, currentHint, puzzleNumber })'), before);
      assert.equal(query('#solution-title').textContent, language === 'ko' ? '解説' : '풀이');
      assert.equal(query('#hint-box').hidden, false);
      assert.equal(query('#board-size').disabled, true);
      query('#new-puzzle').click();
      assert.equal(value('puzzleNumber'), before.puzzleNumber);
      query('#next-puzzle').click();
      assert.equal(value('puzzleNumber'), before.puzzleNumber + 1);
      assert.equal(query('#answer-input').disabled, false);
      assert.equal(query('#new-puzzle').disabled, false);
      assert.equal(query('#board-size').disabled, false);
      assert.equal(query('#give-up').hidden, false);
      assert.equal(query('#next-puzzle').hidden, true);
      assert.equal(query('#solution-panel').hidden, true);
      assert.equal(query('#solution-list').children.length, 0);
      assert.equal(window.document.querySelectorAll('.solution-cell').length, 0);
    }, { language });
  });
}

test('give up without a valid answer records an unanswered failure and survives reload', async () => {
  for (const raw of ['', '-1', '1.5']) {
    let saved;
    await withGame(({ query, value, window }) => {
      query('#open-squares').click();
      query('#answer-input').value = raw;
      query('#give-up').click();
      assert.equal(value('records.history[0].answer'), null);
      assert.equal(value('records.history[0].correct'), false);
      assert.equal(value('records.played'), 9);
      assert.match(query('#history-list').textContent, /미입력/);
      saved = JSON.parse(window.localStorage.getItem(recordsKey));
    });
    await withGame(({ query, value }) => {
      assert.deepEqual(value('records'), saved);
      assert.match(query('#history-list').textContent, /未入力/);
    }, { language: 'ja', records: saved });
  }
});

test('storage disabled: wrong retries and give up still expose solutions and allow Next', async () => {
  await withGame(({ query, value }) => {
    query('#open-squares').click();
    query('#answer-input').value = String(value('currentAnswer') + 1);
    query('#submit-answer').click();
    assert.equal(query('#answer-feedback').textContent, '오답입니다.');
    assert.equal(value('records.played'), 0);
    query('#give-up').click();
    assert.equal(query('#solution-panel').hidden, false);
    assert.ok(query('#solution-list').children.length);
    assert.match(query('#answer-feedback').textContent, /저장/);
    query('#next-puzzle').click();
    assert.equal(query('#answer-input').disabled, false);
  }, { blockedStorage: true });
});

for (const pointerType of ['mouse', 'touch']) {
  test(`cubes: continuous ${pointerType} drag, tilt, pointer capture, reset and locale preservation`, async () => {
    await withGame(({ query, value, window, pointer, flushFrames, originalStorage }) => {
      query('#open-cubes').click();
      query('#show-hint').click();
      query('#show-columns').click();
      query('#answer-input').value = '12';
      const before = value('({ currentBoard, currentAnswer, currentHint, puzzleNumber, records })');
      const geometry = query('#board').innerHTML;
      const initialYaw = value('cubeYaw');
      const initialPitch = value('cubePitch');
      pointer('pointerdown', { pointerType, clientX: 100, clientY: 100 });
      assert.equal(query('#board').hasPointerCapture(1), true);
      pointer('pointermove', { pointerType, clientX: 101, clientY: 102 });
      assert.ok(value('cubeYaw') > initialYaw);
      assert.ok(value('cubeYaw') - initialYaw < 0.1);
      assert.ok(value('cubePitch') > initialPitch);
      flushFrames();
      assert.notEqual(query('#board').innerHTML, geometry);
      pointer('pointermove', { pointerType, clientX: 190, clientY: 155 });
      pointer('pointerup', { pointerType });
      flushFrames();
      assert.equal(query('#board').hasPointerCapture(1), false);
      assert.equal(query('#board').classList.contains('dragging'), false);
      const view = value('({ cubeYaw, cubePitch })');
      query('#language-ja').click();
      assert.deepEqual(value('({ cubeYaw, cubePitch })'), view);
      assert.equal(query('#answer-input').value, '12');
      assert.equal(query('#hint-box').hidden, false);
      assert.equal(query('#column-view').hidden, false);
      assert.match(query('#cube-drag-guide').textContent, /ドラッグ/);
      assert.deepEqual(value('({ currentBoard, currentAnswer, currentHint, puzzleNumber, records })'), before);
      assert.equal(window.localStorage.getItem(recordsKey), originalStorage);
      query('#reset-cube-view').click();
      flushFrames();
      assert.equal(value('cubeYaw'), initialYaw);
      assert.equal(value('cubePitch'), initialPitch);
      assert.equal(query('#board').innerHTML, geometry);
      assert.deepEqual(value('({ currentBoard, currentAnswer, currentHint, puzzleNumber, records })'), before);
    });
  });
}

test('cubes: secondary input, cancellation, lost capture, blur and navigation never leave a stuck drag', async () => {
  await withGame(({ query, value, pointer, window, flushFrames }) => {
    query('#open-cubes').click();
    for (const options of [{ button: 2 }, { isPrimary: false }]) {
      pointer('pointerdown', options);
      assert.equal(value('cubeDrag'), null);
    }
    for (const end of ['pointercancel', 'lostpointercapture', 'blur', 'navigation']) {
      pointer('pointerdown', { clientX: 10, clientY: 10 });
      pointer('pointerdown', { pointerId: 2, clientX: 50, clientY: 50 });
      assert.equal(value('cubeDrag.id'), 1);
      const view = value('({ cubeYaw, cubePitch })');
      pointer('pointermove', { pointerId: 2, clientX: 100, clientY: 100 });
      pointer('pointerup', { pointerId: 2 });
      assert.deepEqual(value('({ cubeYaw, cubePitch })'), view);
      if (end === 'blur') window.dispatchEvent(new window.Event('blur'));
      else if (end === 'navigation') query('#back-home').click();
      else pointer(end);
      assert.equal(value('cubeDrag'), null);
      assert.equal(query('#board').classList.contains('dragging'), false);
      pointer('pointermove', { clientX: 400, clientY: 400 });
      flushFrames();
      assert.deepEqual(value('({ cubeYaw, cubePitch })'), view);
    }
    query('#open-squares').click();
    assert.equal(query('#cube-controls').hidden, true);
    assert.equal(query('#board').hasAttribute('tabindex'), false);
    pointer('pointerdown');
    assert.equal(value('cubeDrag'), null);
  });
});

test('cubes: every size retains column heights, hints and solution totals through rotation', async () => {
  await withGame(({ query, value, window, evaluate, flushFrames }) => {
    query('#open-cubes').click();
    for (const size of [3, 4, 5]) {
      query('#board-size').value = String(size);
      query('#board-size').dispatchEvent(new window.Event('change'));
      assert.equal(query('#column-view').hidden, true);
      query('#show-columns').click();
      assert.equal(query('#show-columns').getAttribute('aria-expanded'), 'true');
      assert.deepEqual(Array.from(query('#column-view').children, cell => Number(cell.textContent)), value('currentBoard.flat()'));
      const total = value('currentAnswer');
      for (const pitch of [0.12, Math.PI / 6, 1.4]) {
        for (let turn = 0; turn < 8; turn++) {
          evaluate(`cubeYaw = ${turn * Math.PI / 4}; cubePitch = ${pitch}; renderCubeStack(currentBoard);`);
          const svg = query('#board svg');
          const [left, top, width, height] = svg.getAttribute('viewBox').split(' ').map(Number);
          assert.equal(window.document.querySelectorAll('.cube-top-face').length, size * size);
          for (const face of svg.children) {
            for (const pair of face.getAttribute('points').split(' ')) {
              const [x, y] = pair.split(',').map(Number);
              assert.ok(Number.isFinite(x) && x >= left && x <= left + width);
              assert.ok(Number.isFinite(y) && y >= top && y <= top + height);
            }
          }
        }
      }
      query('#board').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
      flushFrames();
      assert.ok(value('cubePitch') <= 1.4);
      query('#answer-input').value = String(total);
      query('#submit-answer').click();
      assert.equal(query('#solution-panel').hidden, false);
      assert.equal(query('#solution-list').children.length, size);
      assert.ok(query('#solution-summary').textContent.includes(String(total)));
      assert.equal(value('records.history[0].solution'), total);
    }
  });
});

test('translations have matching keys and scoped touch behavior only disables scrolling on the cube board', async () => {
  await withGame(({ value }) => assert.deepEqual(value('Object.keys(copy.ko).sort()'), value('Object.keys(copy.ja).sort()')));
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(cssText);
  const visit = rules => {
    for (const rule of rules) {
      if (rule.style?.getPropertyValue('touch-action') === 'none') assert.equal(rule.selectorText, '.devil-game .cube-board');
      if (rule.cssRules) visit(rule.cssRules);
    }
  };
  visit(sheet.cssRules);
});

(async () => {
  const keys = [recordsKey, languageKey, 'i18nextLng'];
  const saved = keys.map(key => localStorage.getItem(key));
  const results = [];
  try {
    [html, script, cssText] = await Promise.all(['index.html', 'script.js', 'style.css'].map(async file => {
      const response = await fetch(new URL(file, gameBase));
      if (!response.ok) throw new Error(file + ': ' + response.status);
      return response.text();
    }));
    for (const { name, run } of tests) {
      const item = document.createElement('li');
      try { await run(); results.push({ name, passed: true }); item.textContent = 'PASS: ' + name; }
      catch (error) { results.push({ name, passed: false, error: String(error) }); item.textContent = 'FAIL: ' + name + ' — ' + error; }
      document.getElementById('results').append(item);
    }
  } catch (error) { results.push({ name: 'Load fixtures', passed: false, error: String(error) }); }
  finally {
    keys.forEach((key, index) => saved[index] === null ? localStorage.removeItem(key) : localStorage.setItem(key, saved[index]));
  }
  window.__puzzleTests = { done: true, total: results.length, passed: results.filter(result => result.passed).length, results };
  document.getElementById('summary').textContent = window.__puzzleTests.passed + '/' + results.length + ' passed';
})();
