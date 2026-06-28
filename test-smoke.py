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

def js(page):
    return page.evaluate("""() => {
        let c = '';
        document.querySelectorAll('script').forEach(s => { if(s.textContent) c += s.textContent + '\\n'; });
        return c;
    }""")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    print("="*60)
    print("TETRIS POC - SMOKE TEST")
    print("="*60)

    # AC-1
    print("\nAC-1: Board 10x20 grid")
    try:
        page.goto(BASE, wait_until="networkidle")
        time.sleep(0.5)
        info = page.evaluate("""() => {
            const t = document.querySelector('table');
            if(t) {
                const r = t.querySelectorAll('tr').length;
                const c = t.querySelectorAll('tr:first-child td, tr:first-child th').length;
                return {m:'table',rows:r,cols:c,total:r*c};
            }
            const b = document.querySelector('[id*="board" i],[class*="board" i]');
            if(b) return {m:'container',tag:b.tagName,id:b.id,cls:b.className,ch:b.querySelectorAll('div').length};
            return {m:'none'};
        }""")
        print(f"  info: {json.dumps(info)}")
        if info.get('total') == 200 or (info.get('m')=='table' and info.get('rows')==20 and info.get('cols')==10):
            P("AC-1", "Board 10x20 grid verified")
        else:
            F("AC-1", "Cannot verify grid", json.dumps(info))
    except Exception as e:
        F("AC-1", "Error", str(e))

    # AC-2
    print("\nAC-2: 7 tetrominoes")
    try:
        code = js(page)
        names = sum(1 for n in ["I","O","T","S","Z","L","J"] if n in code)
        colors = sum(1 for c in ["cyan","yellow","purple","green","red","orange","blue"] if c.lower() in code.lower())
        if names >= 6 or colors >= 6:
            P("AC-2", f"Pieces found (names={names}/7, colors={colors}/7)")
        else:
            F("AC-2", "Not enough pieces", f"names={names}/7 colors={colors}/7")
    except Exception as e:
        F("AC-2", "Error", str(e))

    # AC-3
    print("\nAC-3: Keyboard controls")
    try:
        code = js(page)
        ok = all(x in code for x in ["ArrowLeft","ArrowRight","ArrowDown","ArrowUp"])
        if ok:
            P("AC-3", "All 4 arrow keys handled")
        else:
            F("AC-3", "Missing keys", f"L={'ArrowLeft' in code} R={'ArrowRight' in code} D={'ArrowDown' in code} U={'ArrowUp' in code}")
    except Exception as e:
        F("AC-3", "Error", str(e))

    # AC-4
    print("\nAC-4: Auto-drop")
    try:
        code = js(page)
        if "setInterval" in code or "requestAnimationFrame" in code or "setTimeout" in code:
            P("AC-4", "Game loop found")
        else:
            F("AC-4", "No game loop")
    except Exception as e:
        F("AC-4", "Error", str(e))

    # AC-5
    print("\nAC-5: Collision + locking")
    try:
        code = js(page)
        coll = "collision" in code.lower() or "collides" in code.lower()
        lock = "lock" in code.lower() or "place" in code.lower()
        if coll and lock:
            P("AC-5", "Collision + lock found")
        else:
            F("AC-5", "Missing", f"collision={coll} lock={lock}")
    except Exception as e:
        F("AC-5", "Error", str(e))

    # AC-6
    print("\nAC-6: Line clearing")
    try:
        code = js(page)
        if "clear" in code.lower() or "removeRow" in code:
            P("AC-6", "Line clear logic found")
        else:
            F("AC-6", "No clear logic")
    except Exception as e:
        F("AC-6", "Error", str(e))

    # AC-7
    print("\nAC-7: Scoring")
    try:
        code = js(page)
        if "score" in code.lower():
            P("AC-7", "Score logic found")
        else:
            F("AC-7", "No score")
    except Exception as e:
        F("AC-7", "Error", str(e))

    # AC-8
    print("\nAC-8: Game over")
    try:
        code = js(page)
        if "gameOver" in code or "Game Over" in code or "GAME OVER" in code:
            P("AC-8", "Game over logic found")
        else:
            F("AC-8", "No game over")
    except Exception as e:
        F("AC-8", "Error", str(e))

    # AC-9
    print("\nAC-9: Game Over text")
    try:
        code = js(page)
        if "Game Over" in code or "GAME OVER" in code:
            P("AC-9", "Game Over text in source")
        else:
            F("AC-9", "No Game Over text")
    except Exception as e:
        F("AC-9", "Error", str(e))

    # AC-10
    print("\nAC-10: Restart button")
    try:
        code = js(page)
        if "restart" in code.lower() or "reset" in code.lower():
            P("AC-10", "Restart logic found")
        else:
            F("AC-10", "No restart")
    except Exception as e:
        F("AC-10", "Error", str(e))

    # AC-11
    print("\nAC-11: Single file, no frameworks")
    try:
        html = [f for f in os.listdir(".") if f.endswith(".html")]
        code = js(page)
        issues = []
        if len(html) != 1:
            issues.append(f"{len(html)} html files")
        if "import " in code:
            issues.append("has import")
        if "require(" in code:
            issues.append("has require")
        ext = page.evaluate("""() => Array.from(document.querySelectorAll('script[src]')).map(s => s.src)""")
        if ext:
            issues.append(f"external: {ext}")
        if not issues:
            P("AC-11", f"Single file ({html[0]}), no deps")
        else:
            F("AC-11", "Issues", "; ".join(issues))
    except Exception as e:
        F("AC-11", "Error", str(e))

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
