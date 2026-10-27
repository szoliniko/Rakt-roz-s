#!/usr/bin/env python3
"""Narrow v6 classic-bundle checks, separate from the shared-server workflow."""
from pathlib import Path
import json
import shutil
import tempfile
from playwright.sync_api import sync_playwright, expect
from check_foundations_app import TestServer

ROOT=Path(__file__).resolve().parents[1]
CSP="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'"


def login(frame):
    form=frame.locator('#login-form')
    expect(form).to_be_visible(timeout=10000)
    form.locator('[name="userId"]').select_option('test-manager')
    form.locator('[name="pin"]').fill('1234')
    form.locator('button[type="submit"]').click()
    expect(form).to_have_count(0)


def issue(frame):
    frame.locator('#app [data-view="issue"]').click()
    frame.locator('[name="from"]').select_option('Fő raktár')
    frame.locator('[name="to"]').select_option('Saloon')
    frame.locator('[name="search-0"]').fill('521')
    frame.locator('[name="product-0"]').select_option('source-521')
    frame.locator('[name="quantity-0"]').fill('2')
    frame.locator('#move-form button[type="submit"]').click()
    expect(frame.locator('#review-panel')).to_be_visible()
    frame.locator('[data-action="confirm-review"]').click()
    expect(frame.locator('#move-status')).to_have_attribute('data-status','pending')
    return frame.locator('#move-status').get_attribute('data-move-id')


def main():
    html=(ROOT/'demo/raktar-bemutato-v6.html').read_text()
    for name in ['index.html','raktar-bemutato.html',*[f'raktar-bemutato-v{i}.html' for i in range(2,6)]]:
        assert (ROOT/'demo'/name).read_text()==html
    assert 'type="module"' not in html and 'src="app.mjs"' not in html
    report={'scope':'Standalone v6 preview only; explicit local storage modes, no shared-server capability claim.', 'checks':[], 'script_errors':[]}
    with tempfile.TemporaryDirectory(prefix='raktar-preview-') as folder, sync_playwright() as p:
        server=TestServer(Path(folder)/'test.sqlite');server.start()
        browser=p.chromium.launch(executable_path=shutil.which('chromium'),args=['--no-sandbox'])
        try:
            context=browser.new_context(viewport={'width':1024,'height':900})
            page=context.new_page();page.on('pageerror',lambda e:report['script_errors'].append(str(e)))
            api_requests=[]
            page.on('request',lambda req:api_requests.append(req.url) if '/api/' in req.url else None)
            page.goto(server.url+'/demo/raktar-bemutato-v6.html')
            login(page)
            expect(page.locator('#connection-status')).to_contain_text('Helyi tesztüzem')
            expect(page.locator('#connection-status')).to_contain_text('mentés ebben a böngészőben')
            move_id=issue(page)
            page.reload()
            expect(page.locator(f'#app [data-move-id="{move_id}"]')).to_be_visible(timeout=10000)
            assert api_requests==[],api_requests
            report['checks'].append('The standalone artifact uses IndexedDB on an ordinary origin; a reviewed PDF-product issue survives reload and makes no server API request.')
            context.close()
            context=browser.new_context(offline=True,viewport={'width':1024,'height':900})
            page=context.new_page();page.on('pageerror',lambda e:report['script_errors'].append(str(e)))
            requests=[];page.on('request',lambda req:requests.append(req.url) if req.url.startswith(('http:','https:')) else None)
            page.set_content('<iframe id="preview" sandbox="allow-scripts" style="width:100%;height:1600px"></iframe>')
            restricted=html.replace('<head>',f'<head><meta http-equiv="Content-Security-Policy" content="{CSP}">',1)
            page.locator('#preview').evaluate('(el,html)=>el.srcdoc=html',restricted)
            frame=page.frame_locator('#preview');login(frame)
            expect(frame.locator('#connection-status')).to_contain_text('tiltja a tartós mentést')
            move_id=issue(frame)
            frame.locator('#nav [data-view="help"]').click()
            frame.locator('summary',has_text='Késés kipróbálása várakozás nélkül').click()
            frame.locator('[data-action="advance-demo-clock"]').click()
            expect(frame.locator('#demo-clock-notice')).to_contain_text('+31 perc')
            expect(frame.locator(f'[data-transfer-id="{move_id}"]')).to_have_class('transfer-row is-overdue')
            assert requests==[],requests
            report['checks'].append('An offline opaque allow-scripts iframe supports login, PDF selection, review and local clock demonstration; unavailable persistence is visibly disclosed and no external request occurs.')
            context.close()
        finally:
            browser.close();server.stop()
    assert not report['script_errors'],report['script_errors']
    out=ROOT/'.impeccable/review/foundations-preview.json';out.write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':main()
