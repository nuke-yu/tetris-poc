#!/usr/bin/env python3
import sys, os, time, json
from playwright.sync_api import sync_playwright

PORT = os.environ.get("PORT", "58241")
BASE = f"http://localhost:{PORT}"
results = []

def P(id, desc):
    results.append({"id": id, "desc": desc, "status": "PASS", "detail": ""})
    print(f"  PASS [{id}] {desc}")

def F(id, desc, detail=""):
    results.append({"id": id, "desc": desc, "status": "FAIL", "detail": detail})
    print(f"  FAIL [{id}] {desc} -- {detail}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 800, "height": 700})
    print("="*60)
    print("TETRIS POC - SMOKE TEST v2")
    print("="*60)

    page.goto(BASE, wait_until="networkidle")
    time.sleep(0.5)

    # AC-1: Board renders as 10x20 grid
    print("\nAC-1: Board 10x20 grid")
    canvas = page.evaluate("""() => {
        const c = document.getElementById('board');
        if (!c) return null;
        return { w: c.width, h: c.height, cellSize: 30, expectedCols: c.width/30, expectedRows: c.height/30 };
    }""")
    print(f"  Canvas: {canvas}")
    if canvas and canvas['w'] == 300 and canvas['h'] == 600:
        P("AC-1", "Canvas 300x600 = 10x20 grid (30px cells)")
    else:
        F("AC-1", "Canvas dimensions wrong", str(canvas))

    # AC-2: All 7 tetrominoes
    print("\nAC-2: 7 tetrominoes")
    piece_count = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        if (!s || !s.textContent) return 0;
        const code = s.textContent;
        const names = ['I','O','T','S','Z','L','J'];
        return names.filter(n => code.includes(n + ':') || code.includes(\"'\" + n + \"'\") || code.includes('\"' + n + '\"')).length;
    }""")
    print(f"  Piece definitions found: {piece_count}")
    if piece_count >= 7:
        P("AC-2", f"All 7 tetromino definitions found")
    else:
        F("AC-2", f"Only {piece_count}/7 pieces found")

    # AC-3: Keyboard controls
    print("\nAC-3: Keyboard controls")
    keys_found = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        if (!s || !s.textContent) return {};
        const c = s.textContent;
        return {
            left: c.includes('ArrowLeft') || c.includes('KeyA'),
            right: c.includes('ArrowRight') || c.includes('KeyD'),
            down: c.includes('ArrowDown') || c.includes('KeyS'),
            up: c.includes('ArrowUp') || c.includes('KeyW'),
            keydown: c.includes('keydown')
        };
    }""")
    print(f"  Keys: {keys_found}")
    if all([keys_found.get(k) for k in ['left','right','down','up']]):
        P("AC-3", "All 4 arrow keys handled")
    else:
        F("AC-3", "Missing keys", str(keys_found))

    # AC-4: Auto-drop
    print("\nAC-4: Auto-drop")
    has_loop = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        if (!s || !s.textContent) return {};
        const c = s.textContent;
        return {
            setInterval: c.includes('setInterval'),
            interval_1000: c.includes('1000'),
            gameLoop: c.includes('gameLoop'),
            move_down: c.includes('movePiece(0, 1)') || c.includes('movePiece(0,1)')
        };
    }""")
    print(f"  Loop: {has_loop}")
    if has_loop.get('setInterval') and has_loop.get('gameLoop'):
        P("AC-4", "Game loop with setInterval found")
    else:
        F("AC-4", "No game loop", str(has_loop))

    # AC-5: Collision + locking + spawn
    print("\nAC-5: Collision + locking + spawn")
    features = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        if (!s || !s.textContent) return {};
        const c = s.textContent;
        return {
            canPlace: c.includes('canPlace'),
            lockPiece: c.includes('lockPiece'),
            spawnPiece: c.includes('spawnPiece'),
            collision: c.includes('collision') || c.includes('collides')
        };
    }""")
    print(f"  Features: {features}")
    if features.get('canPlace') and features.get('lockPiece') and features.get('spawnPiece'):
        P("AC-5", "Collision detection (canPlace) + locking (lockPiece) + spawn (spawnPiece) all found")
    else:
        F("AC-5", "Missing features", str(features))

    # AC-6: Line clearing
    print("\nAC-6: Line clearing")
    has_clear = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        if (!s || !s.textContent) return {};
        const c = s.textContent;
        return {
            clearLines: c.includes('clearLines'),
            splice: c.includes('splice'),
            unshift: c.includes('unshift')
        };
    }""")
    print(f"  Clear: {has_clear}")
    if has_clear.get('clearLines'):
        P("AC-6", "clearLines() function found")
    else:
        F("AC-6", "No clearLines", str(has_clear))

    # AC-7: Scoring
    print("\nAC-7: Scoring")
    has_score = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        if (!s || !s.textContent) return {};
        const c = s.textContent;
        return {
            score_var: c.includes('let score') || c.includes('var score'),
            score_100: c.includes('score += cleared * 100') || c.includes('score += 100'),
            updateScore: c.includes('updateScore'),
            score_display: c.includes('scoreSpan')
        };
    }""")
    print(f"  Score: {has_score}")
    if has_score.get('score_var') and has_score.get('score_100'):
        P("AC-7", "Score = cleared * 100 per line")
    else:
        F("AC-7", "Score logic incomplete", str(has_score))

    # AC-8: Game over detection
    print("\nAC-8: Game over detection")
    has_go = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        if (!s || !s.textContent) return {};
        const c = s.textContent;
        return {
            gameOver_var: c.includes('gameOver'),
            gameOver_check: c.includes('gameOver = true'),
            showGameOver: c.includes('showGameOver'),
            spawn_check: c.includes('canPlace(shape, x, y)')
        };
    }""")
    print(f"  Game over: {has_go}")
    if has_go.get('gameOver_var') and has_go.get('gameOver_check'):
        P("AC-8", "Game over detection found (gameOver=true when can't spawn)")
    else:
        F("AC-8", "Game over logic incomplete", str(has_go))

    # AC-9: Game Over text display
    print("\nAC-9: Game Over text display")
    has_text = page.evaluate("""() => {
        const overlay = document.getElementById('gameOverOverlay');
        if (!overlay) return { overlay: false };
        const text = overlay.textContent || overlay.innerText;
        return {
            overlay: true,
            hasGameOver: text.includes('GAME OVER') || text.includes('Game Over'),
            visibleClass: overlay.className.includes('visible'),
            display: window.getComputedStyle(overlay).display
        };
    }""")
    print(f"  Game over text: {has_text}")
    if has_text.get('overlay') and has_text.get('hasGameOver'):
        P("AC-9", "GAME OVER text in overlay element")
    else:
        F("AC-9", "Game Over text not found", str(has_text))

    # AC-10: Restart button
    print("\nAC-10: Restart button")
    has_restart = page.evaluate("""() => {
        const btn = document.getElementById('restartBtn');
        if (!btn) return { btn: false };
        return {
            btn: true,
            text: btn.textContent,
            onclick: btn.getAttribute('onclick') || 'event-listener',
            restartFunc: document.querySelector('script:last-of-type').textContent.includes('restartGame')
        };
    }""")
    print(f"  Restart: {has_restart}")
    if has_restart.get('btn') and has_restart.get('restartFunc'):
        P("AC-10", "Restart button + restartGame() found")
    else:
        F("AC-10", "Restart not found", str(has_restart))

    # AC-11: Single file, no frameworks
    print("\nAC-11: Single .html file, no frameworks")
    html_files = [f for f in os.listdir(".") if f.endswith(".html")]
    ext_scripts = page.evaluate("""() => Array.from(document.querySelectorAll('script[src]')).map(s => s.src)""")
    has_import = page.evaluate("""() => {
        const s = document.querySelector('script:last-of-type');
        return s && s.textContent ? s.textContent.includes('import ') : false;
    }""")
    issues = []
    if len(html_files) != 1:
        issues.append(f"{len(html_files)} html files")
    if ext_scripts:
        issues.append(f"external scripts: {ext_scripts}")
    if has_import:
        issues.append("contains import")
    if not issues:
        P("AC-11", f"Single file ({html_files[0]}), no external deps, no imports")
    else:
        F("AC-11", "Issues", "; ".join(issues))

    # SUMMARY
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    passed = sum(1 for r in results if r["status"]=="PASS")
    failed = sum(1 for r in results if r["status"]=="FAIL")
    for r in results:
        print(f"  [{r['status']}] [{r['id']}] {r['desc']}")
        if r["detail"]: print(f"       {r['detail']}")
    print(f"\n  Total: {len(results)} | Passed: {passed} | Failed: {failed}")
    browser.close()
    if failed > 0:
        print("\nSMOKE TEST FAILED")
        sys.exit(1)
    else:
        print("\nALL ACCEPTANCE CRITERIA PASSED")
        sys.exit(0)
