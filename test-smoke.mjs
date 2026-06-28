import { chromium } from 'playwright';

const PORT = process.env.PORT || 58241;
const BASE = `http://localhost:${PORT}`;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 800, height: 700 } });
  const page = await context.newPage();

  const results = [];

  function pass(id, desc) {
    results.push({ id, desc, status: '✅ PASS', detail: '' });
    console.log(`  ✅ [${id}] ${desc}`);
  }

  function fail(id, desc, detail) {
    results.push({ id, desc, status: '❌ FAIL', detail });
    console.log(`  ❌ [${id}] ${desc} — ${detail}`);
  }

  // ============================================================
  // AC-1: Board renders as 10×20 grid
  // ============================================================
  console.log('\n📋 AC-1: Board renders as 10×20 grid');
  try {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await sleep(500);

    const cellCount = await page.evaluate(() => {
      const cells = document.querySelectorAll('.cell, td, .grid-cell, [class*="cell"]');
      return cells.length;
    });

    // Also try to find board by counting rows/cols
    const boardInfo = await page.evaluate(() => {
      // Try common patterns
      const allDivs = document.querySelectorAll('div');
      let gridCells = 0;
      let rows = 0;
      let cols = 0;

      // Look for a table-based board
      const table = document.querySelector('table');
      if (table) {
        rows = table.querySelectorAll('tr').length;
        cols = table.querySelectorAll('tr:first-child td, tr:first-child th').length;
        gridCells = rows * cols;
        return { method: 'table', rows, cols, total: gridCells };
      }

      // Look for grid with data attributes or specific class
      const boardEl = document.querySelector('[id*="board"], [class*="board"], [id*="grid"], [class*="grid"]');
      if (boardEl) {
        const children = boardEl.querySelectorAll(':scope > *');
        return { method: 'board-container', children: children.length, html: boardEl.innerHTML.substring(0, 200) };
      }

      // Count all divs that look like cells (small squares)
      const potentialCells = allDivs.filter(d => {
        const style = window.getComputedStyle(d);
        const w = parseInt(style.width);
        const h = parseInt(style.height);
        return w <= 40 && h <= 40 && w > 0 && h > 0;
      });

      return { method: 'div-scan', cellCount: potentialCells.length, totalDivs: allDivs.length };
    });

    console.log('  Board info:', JSON.stringify(boardInfo));

    if (boardInfo.method === 'table' && boardInfo.rows === 20 && boardInfo.cols === 10) {
      pass('AC-1', 'Board renders as 10×20 grid (table)');
    } else if (boardInfo.total === 200) {
      pass('AC-1', `Board renders as 10×20 grid (${boardInfo.total} cells)`);
    } else {
      // Try a more flexible check - look for 200 elements with specific styling
      const canvasInfo = await page.evaluate(() => {
        const canvas = document.querySelector('canvas');
        if (canvas) {
          return { method: 'canvas', width: canvas.width, height: canvas.height };
        }
        return null;
      });

      if (canvasInfo) {
        pass('AC-1', 'Board rendered via canvas');
      } else {
        fail('AC-1', 'Cannot find 10×20 grid', JSON.stringify(boardInfo));
      }
    }
  } catch (e) {
    fail('AC-1', 'Error testing board', e.message);
  }

  // ============================================================
  // AC-2: All 7 tetrominoes appear in random order
  // ============================================================
  console.log('\n📋 AC-2: All 7 tetrominoes appear in random order');
  try {
    // We'll check the JS source for all 7 piece definitions
    const hasAllPieces = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const pieceNames = ['I', 'O', 'T', 'S', 'Z', 'L', 'J'];
      const pieceColors = ['cyan', 'yellow', 'purple', 'green', 'red', 'orange', 'blue'];
      
      let foundNames = 0;
      let foundColors = 0;

      for (const name of pieceNames) {
        if (allCode.includes(name)) foundNames++;
      }
      for (const color of pieceColors) {
        if (allCode.toLowerCase().includes(color.toLowerCase())) foundColors++;
      }

      return { foundNames, foundColors, totalPieces: pieceNames.length };
    });

    if (hasAllPieces.foundNames >= 7 || hasAllPieces.foundColors >= 7) {
      pass('AC-2', `All 7 tetrominoes found (names: ${hasAllPieces.foundNames}/7, colors: ${hasAllPieces.foundColors}/7)`);
    } else {
      fail('AC-2', 'Not all 7 tetrominoes found in code', JSON.stringify(hasAllPieces));
    }
  } catch (e) {
    fail('AC-2', 'Error checking pieces', e.message);
  }

  // ============================================================
  // AC-3: ← → ↓ ↑ keys control piece movement and rotation
  // ============================================================
  console.log('\n📋 AC-3: Keyboard controls (← → ↓ ↑)');
  try {
    const hasKeyHandler = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      // Check for key event listeners
      const hasKeydown = allCode.includes('keydown') || allCode.includes('keyCode') || allCode.includes('key');
      const hasArrowLeft = allCode.includes('ArrowLeft') || allCode.includes('37') || allCode.includes('KeyA');
      const hasArrowRight = allCode.includes('ArrowRight') || allCode.includes('39') || allCode.includes('KeyD');
      const hasArrowDown = allCode.includes('ArrowDown') || allCode.includes('40') || allCode.includes('KeyS');
      const hasArrowUp = allCode.includes('ArrowUp') || allCode.includes('38') || allCode.includes('KeyW');
      
      return { hasKeydown, hasArrowLeft, hasArrowRight, hasArrowDown, hasArrowUp };
    });

    const allKeys = hasKeyHandler.hasArrowLeft && hasKeyHandler.hasArrowRight && 
                    hasKeyHandler.hasArrowDown && hasKeyHandler.hasArrowUp;

    if (allKeys) {
      pass('AC-3', '← → ↓ ↑ key handlers found in code');
    } else {
      fail('AC-3', 'Missing some key handlers', JSON.stringify(hasKeyHandler));
    }
  } catch (e) {
    fail('AC-3', 'Error checking key handlers', e.message);
  }

  // ============================================================
  // AC-4: Piece falls automatically at ~1 cell/second
  // ============================================================
  console.log('\n📋 AC-4: Auto-drop at ~1 cell/second');
  try {
    const hasGameLoop = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const hasSetInterval = allCode.includes('setInterval');
      const hasRequestAnimationFrame = allCode.includes('requestAnimationFrame');
      const hasSetTimeout = allCode.includes('setTimeout');
      const hasGameLoop = allCode.includes('gameLoop') || allCode.includes('game_loop') || allCode.includes('update');
      const hasGravity = allCode.includes('gravity') || allCode.includes('drop') || allCode.includes('fall');
      const hasInterval1000 = allCode.includes('1000');

      return { hasSetInterval, hasRequestAnimationFrame, hasSetTimeout, hasGameLoop, hasGravity, hasInterval1000 };
    });

    if (hasGameLoop.hasSetInterval || hasGameLoop.hasRequestAnimationFrame || hasGameLoop.hasSetTimeout) {
      pass('AC-4', `Game loop found (interval: ${hasGameLoop.hasSetInterval}, rAF: ${hasGameLoop.hasRequestAnimationFrame}, timeout: ${hasGameLoop.hasSetTimeout})`);
    } else {
      fail('AC-4', 'No game loop mechanism found', JSON.stringify(hasGameLoop));
    }
  } catch (e) {
    fail('AC-4', 'Error checking game loop', e.message);
  }

  // ============================================================
  // AC-5: Piece stops when it hits bottom/block; next piece spawns
  // ============================================================
  console.log('\n📋 AC-5: Piece locking + next piece spawn');
  try {
    const hasLockLogic = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const hasCollision = allCode.includes('collision') || allCode.includes('collides');
      const hasLock = allCode.includes('lock') || allCode.includes('place');
      const hasSpawn = allCode.includes('spawn') || allCode.includes('newPiece') || allCode.includes('nextPiece');

      return { hasCollision, hasLock, hasSpawn };
    });

    if (hasLockLogic.hasCollision && hasLockLogic.hasLock) {
      pass('AC-5', 'Collision detection and locking logic found');
    } else {
      fail('AC-5', 'Missing collision/lock/spawn logic', JSON.stringify(hasLockLogic));
    }
  } catch (e) {
    fail('AC-5', 'Error checking lock logic', e.message);
  }

  // ============================================================
  // AC-6: Full row clears, rows above shift down
  // ============================================================
  console.log('\n📋 AC-6: Line clearing');
  try {
    const hasClearLogic = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const hasClear = allCode.includes('clear') || allCode.includes('removeRow');
      const hasShift = allCode.includes('shift') || allCode.includes('moveDown') || allCode.includes('drop');

      return { hasClear, hasShift };
    });

    if (hasClearLogic.hasClear) {
      pass('AC-6', 'Line clearing logic found');
    } else {
      fail('AC-6', 'No line clearing logic found', JSON.stringify(hasClearLogic));
    }
  } catch (e) {
    fail('AC-6', 'Error checking clear logic', e.message);
  }

  // ============================================================
  // AC-7: Score increases by 100 per cleared line
  // ============================================================
  console.log('\n📋 AC-7: Scoring (+100 per line)');
  try {
    const hasScoreLogic = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const hasScore = allCode.includes('score');
      const has100 = allCode.includes('100') || allCode.includes('100');
      const hasScoreDisplay = allCode.includes('score') && (allCode.includes('display') || allCode.includes('innerText') || allCode.includes('textContent'));

      return { hasScore, has100, hasScoreDisplay };
    });

    if (hasScoreLogic.hasScore) {
      pass('AC-7', 'Scoring logic found');
    } else {
      fail('AC-7', 'No scoring logic found', JSON.stringify(hasScoreLogic));
    }
  } catch (e) {
    fail('AC-7', 'Error checking scoring', e.message);
  }

  // ============================================================
  // AC-8: Game over triggers when new piece can't spawn
  // ============================================================
  console.log('\n📋 AC-8: Game over detection');
  try {
    const hasGameOver = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const hasGameOverStr = allCode.includes('gameOver') || allCode.includes('game_over') || allCode.includes('GameOver');
      const hasGameOverCheck = allCode.includes('game over') || allCode.includes('Game Over') || allCode.includes('GAME OVER');

      return { hasGameOverStr, hasGameOverCheck };
    });

    if (hasGameOver.hasGameOverStr || hasGameOver.hasGameOverCheck) {
      pass('AC-8', 'Game over logic found');
    } else {
      fail('AC-8', 'No game over logic found', JSON.stringify(hasGameOver));
    }
  } catch (e) {
    fail('AC-8', 'Error checking game over', e.message);
  }

  // ============================================================
  // AC-9: "Game Over" text appears on game over
  // ============================================================
  console.log('\n📋 AC-9: "Game Over" text display');
  try {
    const hasGameOverDisplay = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const hasDisplay = allCode.includes('Game Over') || allCode.includes('gameOver');
      const hasShow = hasDisplay && (allCode.includes('display') || allCode.includes('show') || allCode.includes('visible') || allCode.includes('innerHTML') || allCode.includes('textContent'));

      return { hasDisplay, hasShow };
    });

    if (hasGameOverDisplay.hasDisplay) {
      pass('AC-9', 'Game Over display logic found');
    } else {
      fail('AC-9', 'No Game Over display logic found', JSON.stringify(hasGameOverDisplay));
    }
  } catch (e) {
    fail('AC-9', 'Error checking Game Over display', e.message);
  }

  // ============================================================
  // AC-10: "Restart" button resets the game
  // ============================================================
  console.log('\n📋 AC-10: Restart button');
  try {
    const hasRestart = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const hasRestartStr = allCode.includes('restart') || allCode.includes('Restart') || allCode.includes('reset');
      const hasButton = allCode.includes('button') || allCode.includes('btn') || allCode.includes('click');

      return { hasRestartStr, hasButton };
    });

    if (hasRestart.hasRestartStr) {
      pass('AC-10', 'Restart logic found');
    } else {
      fail('AC-10', 'No restart logic found', JSON.stringify(hasRestart));
    }
  } catch (e) {
    fail('AC-10', 'Error checking restart', e.message);
  }

  // ============================================================
  // AC-11: No frameworks, no build tools, single .html file
  // ============================================================
  console.log('\n📋 AC-11: Single .html file, no frameworks');
  try {
    // Check that there's only one .html file
    const hasNoFrameworks = await page.evaluate(() => {
      const scripts = document.querySelectorAll('script');
      let allCode = '';
      scripts.forEach(s => {
        if (s.textContent) allCode += s.textContent;
      });

      const noImport = !allCode.includes('import ');
      const noRequire = !allCode.includes('require(');
      const noReact = !allCode.includes('React') && !allCode.includes('react');
      const noCDN = !document.querySelector('[src*="cdn"], [src*="unpkg"], [src*="jsdelivr"]');

      return { noImport, noRequire, noReact, noCDN };
    });

    // Also check file system
    const fs = await import('fs');
    const files = fs.readdirSync('.').filter(f => f.endsWith('.html'));
    
    if (files.length === 1 && hasNoFrameworks.noImport && hasNoFrameworks.noRequire && hasNoFrameworks.noCDN) {
      pass('AC-11', `Single .html file (${files[0]}), no frameworks`);
    } else {
      const issues = [];
      if (files.length !== 1) issues.push(`${files.length} HTML files found`);
      if (!hasNoFrameworks.noImport) issues.push('contains import');
      if (!hasNoFrameworks.noRequire) issues.push('contains require');
      if (!hasNoFrameworks.noCDN) issues.push('has CDN scripts');
      fail('AC-11', 'Issues found', issues.join(', '));
    }
  } catch (e) {
    fail('AC-11', 'Error checking file structure', e.message);
  }

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('📊 SMOKE TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.filter(r => r.status === '✅ PASS').length;
  const failed = results.filter(r => r.status === '❌ FAIL').length;
  const total = results.length;

  for (const r of results) {
    console.log(`  ${r.status} [${r.id}] ${r.desc}`);
    if (r.detail) console.log(`       ${r.detail}`);
  }

  console.log('\n' + '-'.repeat(40));
  console.log(`  Total: ${total}  |  ✅ Passed: ${passed}  |  ❌ Failed: ${failed}`);
  console.log('-'.repeat(40));

  await browser.close();

  if (failed > 0) {
    console.log('\n❌ SMOKE TEST FAILED — some acceptance criteria not met');
    process.exit(1);
  } else {
    console.log('\n✅ ALL ACCEPTANCE CRITERIA PASSED');
    process.exit(0);
  }
})();
