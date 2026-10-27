#!/usr/bin/env python3
"""Exercise the shared test application through real browser sessions.

Local evidence for durable drafts, named actors, concurrent updates, reviewed
writes, source catalog choices, linked corrections and shift/count recovery.
No request reaches a real StoreHouse or r_keeper installation.
"""

import argparse
import json
from pathlib import Path
import re
import selectors
import shutil
import subprocess
import tempfile
import time

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
WAREHOUSE = 'Fő raktár'
BAR = 'Saloon'
SOURCE_ID = 'source-521'
MANAGER = 'test-manager'
RECEIVER = 'test-receiver-6'
DEPUTY = 'test-deputy-6'


class TestServer:
    def __init__(self, database):
        self.database = database
        self.process = None
        self.url = None
        self.port = 0

    def start(self):
        self.process = subprocess.Popen(
            ['node', 'server/server.mjs', '--test', '--port', str(self.port), '--database', str(self.database)],
            cwd=ROOT, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1,
        )
        ready = selectors.DefaultSelector()
        ready.register(self.process.stdout, selectors.EVENT_READ)
        output = []
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            if self.process.poll() is not None:
                raise AssertionError('Server exited: ' + ''.join(output))
            for key, _ in ready.select(timeout=.25):
                line = key.fileobj.readline()
                output.append(line)
                match = re.search(r'http://127\.0\.0\.1:(\d+)', line)
                if match:
                    self.port = int(match.group(1))
                    self.url = match.group(0)
                    ready.close()
                    return self.url
        self.stop()
        raise AssertionError('Server did not become ready: ' + ''.join(output))

    def stop(self):
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=5)

    def restart(self):
        self.stop()
        return self.start()


class Tablet:
    def __init__(self, browser, server, report, user_id):
        self.context = browser.new_context(viewport={'width': 1024, 'height': 900}, reduced_motion='reduce')
        self.page = self.context.new_page()
        self.server = server
        self.report = report
        self.user_id = user_id
        self.page.on('pageerror', lambda error: report['script_errors'].append(str(error)))
        self.page.on('request', lambda request: report['external_requests'].append(request.url)
                     if request.url.startswith(('http:', 'https:')) and not request.url.startswith(server.url + '/') else None)
        self.page.goto(server.url, wait_until='networkidle')
        self.login(user_id)

    def login(self, user_id):
        self.user_id = user_id
        form = self.page.locator('#login-form')
        expect(form).to_be_visible(timeout=10000)
        form.locator('[name="userId"]').select_option(user_id)
        form.locator('[name="pin"]').fill('1234')
        form.locator('button[type="submit"]').click()
        expect(form).to_have_count(0)
        expect(self.page.locator('#screen-title')).to_be_visible()
        assert self.snapshot()['actor']['id'] == user_id

    def snapshot(self):
        response = self.context.request.get(self.server.url + '/api/state')
        assert response.ok, response.text()
        return response.json()

    def drafts(self):
        response = self.context.request.get(self.server.url + '/api/drafts')
        assert response.ok, response.text()
        return response.json()['drafts']

    def route(self, view):
        nav = self.page.locator(f'#nav [data-view="{view}"]')
        if nav.count():
            nav.first.click()
        else:
            self.page.locator('#nav [data-view="home"]').click()
            self.page.locator(f'#app [data-view="{view}"]').first.click()
        expect(self.page.locator('#screen-title')).to_be_visible()

    def open_form(self, selector):
        form = self.page.locator(selector)
        details = form.locator('xpath=ancestor::details[1]')
        if details.count() and details.get_attribute('open') is None:
            details.locator('summary').first.click()
        expect(form).to_be_visible()
        return form

    def submit(self, selector, review=True):
        form = self.open_form(selector)
        form.locator('button[type="submit"]').click()
        if review:
            expect(self.page.locator('#review-panel')).to_be_visible()
            self.page.locator('[data-action="confirm-review"]').click()
            expect(self.page.locator('#review-panel')).to_have_count(0)

    def fill_line(self, product_id=SOURCE_ID, quantity=3, index=0):
        search = self.page.locator(f'[name="search-{index}"]')
        if search.count():
            search.fill(product_id.removeprefix('source-'))
        self.page.locator(f'[name="product-{index}"]').select_option(product_id)
        self.page.locator(f'[name="quantity-{index}"]').fill(str(quantity))
        self.page.locator(f'[name="unit-{index}"]').select_option('db')

    def issue_form(self, quantity=3, to=BAR):
        self.route('issue')
        self.page.locator('#move-form [name="from"]').select_option(WAREHOUSE)
        self.page.locator('#move-form [name="to"]').select_option(to)
        self.fill_line(quantity=quantity)

    def issue(self, quantity=3, to=BAR):
        self.issue_form(quantity, to)
        self.submit('#move-form')
        expect(self.page.locator('#move-status')).to_have_attribute('data-status', 'pending')
        return self.page.locator('#move-status').get_attribute('data-move-id')

    def open_move(self, move_id):
        self.page.reload(wait_until='networkidle')
        self.route('home')
        self.page.locator(f'#app [data-move-id="{move_id}"]').first.click()
        expect(self.page.locator('#move-status')).to_have_attribute('data-move-id', move_id)

    def capture(self, output, name):
        if not self.report.get('capture_enabled', True):
            return
        for width, device in [(1024, 'tablet'), (390, 'mobile')]:
            self.page.set_viewport_size({'width': width, 'height': 900})
            self.page.evaluate('window.scrollTo(0,0)')
            assert self.page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (name, width)
            filename = f'foundations-{name}-{device}.png'
            self.page.screenshot(path=str(output / filename), full_page=True)
            self.report['screenshots'].append(filename)
        self.page.set_viewport_size({'width': 1024, 'height': 900})

    def close(self):
        self.context.close()


def wait_draft(tablet, key, name, value):
    deadline = time.monotonic() + 8
    while time.monotonic() < deadline:
        matches = [draft for draft in tablet.drafts() if draft['key'] == key]
        if matches and str(matches[0]['value'].get(name)) == str(value):
            return matches[0]
        tablet.page.wait_for_timeout(100)
    raise AssertionError(('Draft not durably saved', key, name, value, tablet.drafts()))


def check(output, capture=True):
    output.mkdir(parents=True, exist_ok=True)
    executable = shutil.which('chromium') or shutil.which('google-chrome')
    assert executable, 'Chromium is required.'
    report = {'scope': 'Actual local shared test server, SQLite and independent browser sessions. No live StoreHouse connection.',
              'checks': [], 'script_errors': [], 'external_requests': [], 'screenshots': [], 'capture_enabled': capture}
    with tempfile.TemporaryDirectory(prefix='warehouse-browser-') as temporary, sync_playwright() as playwright:
        server = TestServer(Path(temporary) / 'state.sqlite')
        server.start()
        browser = playwright.chromium.launch(executable_path=executable, headless=True, args=['--no-sandbox'])
        tablets = []
        try:
            manager = Tablet(browser, server, report, MANAGER)
            tablets.append(manager)
            initial = manager.snapshot()
            catalog = initial['state']['products']
            source = next(item for item in catalog if item['id'] == SOURCE_ID)
            assert source['sourceCode'] == '521' and source['baseUnit'] == 'db'
            assert source.get('externalId') is None
            assert len([item for item in catalog if item.get('sourceCode')]) >= 50
            assert initial['connection']['storeHouse'] == 'not_configured'

            manager.route('issue')
            manager.page.locator('[name="search-0"]').fill('Bazsalikom')
            choices = manager.page.locator('[name="product-0"]').inner_text()
            assert '134' in choices and '187' in choices, choices
            manager.route('stock')
            manager.page.locator('#stock-search').fill('521')
            assert 'Pepsi' in manager.page.locator('#stock-table').inner_text()
            manager.capture(output, 'catalog')
            report['checks'].append('The selectable PDF catalog keeps printed codes, names, groups and units distinct; 134 and 187 Bazsalikom are separate and 521 Pepsi is searchable. Quantities remain synthetic, external IDs unbound.')

            manager.route('shifts')
            manager.page.locator('#shift-open-form [name="location"]').select_option(BAR)
            manager.page.locator('#shift-open-form [name="assigneeId"]').select_option(RECEIVER)
            manager.page.locator('#shift-open-form [name="deputyId"]').select_option(DEPUTY)
            manager.submit('#shift-open-form')
            shift = manager.snapshot()['state']['shifts'][-1]
            assert shift['location'] == BAR and shift['status'] == 'open'

            before = manager.snapshot()
            manager.issue_form(quantity=3)
            manager.open_form('#move-form').locator('button[type="submit"]').click()
            expect(manager.page.locator('#review-panel')).to_be_visible()
            assert manager.snapshot()['revision'] == before['revision'], 'Review must not post stock.'
            manager.page.locator('[data-action="confirm-review"]').click()
            expect(manager.page.locator('#move-status')).to_have_attribute('data-status', 'pending')
            move_id = manager.page.locator('#move-status').get_attribute('data-move-id')
            after_issue = manager.snapshot()
            assert after_issue['state']['stocks'][WAREHOUSE][SOURCE_ID] == before['state']['stocks'][WAREHOUSE][SOURCE_ID] - 3
            assert after_issue['state']['stocks'][BAR][SOURCE_ID] == before['state']['stocks'][BAR][SOURCE_ID]

            receiver = Tablet(browser, server, report, RECEIVER)
            tablets.append(receiver)
            receiver.open_move(move_id)
            receiver.page.locator('#move-receive-form [name="received-0"]').fill('3')
            receiver.submit('#move-receive-form')
            expect(receiver.page.locator('#move-status')).to_have_attribute('data-status', 'done')
            done = receiver.snapshot()
            assert done['state']['stocks'][BAR][SOURCE_ID] == before['state']['stocks'][BAR][SOURCE_ID] + 3
            assert done['state']['history'][-1]['actor']['id'] == RECEIVER
            report['checks'].append('A reviewed multi-tablet issue has one source deduction and one receiver addition, with distinct named actors and server timestamps. Review alone has no stock effect.')

            manager.page.reload(wait_until='networkidle')
            manager.issue_form(quantity=2)
            wait_draft(manager, 'move-issue', 'quantity-0', '2')
            before_restart = manager.snapshot()
            server.restart()
            manager.page.reload(wait_until='networkidle')
            manager.route('issue')
            expect(manager.page.locator('[name="quantity-0"]')).to_have_value('2')
            assert manager.snapshot()['state'] == before_restart['state']
            assert not any(draft['key'] == 'move-issue' for draft in receiver.drafts())
            report['checks'].append('Restarting the server and reloading the browser preserve stock, audit history, sessions and the manager draft; the receiver cannot see that personal draft.')

            other_manager = Tablet(browser, server, report, MANAGER)
            tablets.append(other_manager)
            other_manager.route('receipt')
            other_manager.page.locator('#receipt-form [name="supplier"]').fill('Böngészős próba beszállító')
            other_manager.page.locator('#receipt-form [name="document"]').fill('STALE-FORM-01')
            other_manager.fill_line(quantity=1)
            other_manager.page.locator('#receipt-form [name="destination-0"]').select_option(WAREHOUSE)
            other_manager.page.locator('#receipt-form [name="checked-0"]').check()
            cancelled_id = manager.issue(quantity=2)
            revision = manager.snapshot()['revision']
            other_manager.submit('#receipt-form')
            expect(other_manager.page.locator('#feedback')).to_contain_text('másik dolgozó')
            assert manager.snapshot()['revision'] == revision
            expect(other_manager.page.locator('[name="quantity-0"]')).to_have_value('1')
            report['checks'].append('A stale form from another tablet is rejected without overwriting the newer work or losing the entered quantities.')

            manager.open_move(cancelled_id)
            manager.open_form('#move-cancel-form').locator('[name="reason"]').fill('Az áru nem indult el, a kiadó helyen maradt.')
            manager.page.locator('#move-cancel-form [name="physicalStillAtSource"]').check()
            manager.submit('#move-cancel-form')
            expect(manager.page.locator('#move-status')).to_have_attribute('data-status', 'cancelled')
            cancelled = manager.snapshot()
            assert cancelled['state']['stocks'][WAREHOUSE][SOURCE_ID] == done['state']['stocks'][WAREHOUSE][SOURCE_ID]
            assert len(cancelled['state']['waste']) == 0
            report['checks'].append('A pending issue can be cancelled only with the physical-source check and a reason; the reservation returns once, the original record remains and no waste is fabricated.')

            # The server commits this action, but the first tablet loses the reply.
            manager.issue_form(quantity=1)
            manager.open_form('#move-form').locator('button[type="submit"]').click()
            expect(manager.page.locator('#review-panel')).to_be_visible()
            before_lost = manager.snapshot()
            def lose_reply(route):
                response = route.fetch()
                assert response.ok, response.text()
                route.abort('failed')
            manager.page.route('**/api/commands', lose_reply, times=1)
            manager.page.locator('[data-action="confirm-review"]').click()
            expect(manager.page.locator('#pending-command')).to_be_visible()
            after_lost = manager.snapshot()
            assert after_lost['revision'] == before_lost['revision'] + 1
            manager.page.locator('[data-action="check-pending"]').click()
            expect(manager.page.locator('#pending-command')).to_be_hidden()
            assert manager.snapshot()['revision'] == after_lost['revision']
            lost_move_id = manager.snapshot()['state']['moves'][-1]['id']
            manager.capture(output, 'dashboard')
            report['checks'].append('An intentionally lost reply leaves an explicitly uncertain command; checking its persisted result recovers the accepted move without another stock write.')

            manager.route('home')
            manager.page.locator(f'[data-shift-id="{shift["id"]}"]').first.click()
            manager.page.locator('#shift-handover-form [name="assigneeId"]').select_option(DEPUTY)
            manager.page.locator('#shift-handover-form [name="deputyId"]').select_option(RECEIVER)
            manager.page.locator('#shift-handover-form [name="reason"]').fill('A következő kijelölt dolgozó átveszi a műszakot.')
            before_handover = manager.snapshot()
            manager.submit('#shift-handover-form')
            after_handover = manager.snapshot()
            assert after_handover['state']['moves'] == before_handover['state']['moves']
            assert after_handover['state']['stocks'] == before_handover['state']['stocks']
            assert after_handover['state']['shifts'][-1]['assigneeId'] == DEPUTY
            assert after_handover['state']['shifts'][-1]['handoverHistory'][-1]['previous']['assigneeId'] == RECEIVER
            manager.capture(output, 'handover')
            report['checks'].append('Changing the assigned receiver and deputy preserves the pending transfer and all stock, while recording the previous and new named responsibility.')

            manager.open_move(lost_move_id)
            manager.open_form('#move-cancel-form').locator('[name="reason"]').fill('A próba során az áru a raktárban maradt.')
            manager.page.locator('#move-cancel-form [name="physicalStillAtSource"]').check()
            manager.submit('#move-cancel-form')

            manager.route('history')
            manager.page.locator(f'#history-list [data-move-id="{move_id}"]').first.click()
            original_move = next(move for move in manager.snapshot()['state']['moves'] if move['id'] == move_id)
            correction = manager.page.locator(f'[data-correct-move="{move_id}"]')
            correction.locator('xpath=ancestor::details[1]').locator('summary').click()
            correction.click()
            expect(manager.page.locator('#move-form')).to_have_attribute('data-kind', 'return')
            expect(manager.page.locator('#move-form [name="from"]')).to_have_value(BAR)
            expect(manager.page.locator('#move-form [name="to"]')).to_have_value(WAREHOUSE)
            manager.page.locator('#move-form [name="reason"]').fill('Egy darab visszakerül a raktárba, az eredeti ügyet megőrizzük.')
            manager.page.locator('#move-form [name="quantity-0"]').fill('1')
            manager.submit('#move-form')
            correction_id = manager.page.locator('#move-status').get_attribute('data-move-id')
            receiver.open_move(correction_id)
            receiver.page.locator('#move-receive-form [name="received-0"]').fill('1')
            receiver.submit('#move-receive-form')
            expect(receiver.page.locator('#move-status')).to_have_attribute('data-status', 'done')
            corrected = receiver.snapshot()
            assert next(move for move in corrected['state']['moves'] if move['id'] == move_id) == original_move
            assert corrected['state']['moves'][-1]['correctsMoveId'] == move_id
            assert corrected['state']['stocks'][BAR][SOURCE_ID] == before['state']['stocks'][BAR][SOURCE_ID] + 2
            assert corrected['state']['stocks'][WAREHOUSE][SOURCE_ID] == before['state']['stocks'][WAREHOUSE][SOURCE_ID] - 2
            report['checks'].append('A closed issue is corrected by a separately reviewed and confirmed return linked to its original record; the original quantities and timestamps are unchanged, and only the compensating quantity moves.')

            receiver.page.reload(wait_until='networkidle')
            receiver.route('count')
            receiver.page.locator('#count-start-form [name="paused"]').check()
            receiver.submit('#count-start-form')
            count_id = receiver.page.locator('#count-status').get_attribute('data-count-id')
            assert receiver.snapshot()['state']['shifts'][-1]['status'] == 'counting'
            manager.page.reload(wait_until='networkidle')
            manager.route('home')
            manager.page.locator(f'[data-count-id="{count_id}"]').first.click()
            manager.open_form('#count-cancel-form').locator('[name="reason"]').fill('Még tart a kiszolgálás; később újrakezdjük a számolást.')
            before_cancel = manager.snapshot()
            manager.submit('#count-cancel-form')
            after_cancel = manager.snapshot()
            assert after_cancel['state']['counts'][-1]['status'] == 'cancelled'
            assert after_cancel['state']['shifts'][-1]['status'] == 'open'
            assert after_cancel['state']['stocks'] == before_cancel['state']['stocks']
            report['checks'].append('An opened bar shift remains visibly accountable. A manager can interrupt a started count with a reason, release its movement pause and preserve stock without inventing a correction.')

            receiver.page.reload(wait_until='networkidle')
            receiver.route('count')
            receiver.page.locator('#count-start-form [name="paused"]').check()
            receiver.submit('#count-start-form')
            resumed_id = receiver.page.locator('#count-status').get_attribute('data-count-id')
            rows = receiver.page.locator('.count-row[data-product-id][data-expected]')
            assert rows.count() > 0
            for row in rows.all():
                product_id = row.get_attribute('data-product-id')
                row.locator(f'[name="actual-{product_id}"]').fill(row.get_attribute('data-expected'))
            receiver.submit('#count-submit-form')
            expect(receiver.page.locator('#count-status')).to_have_attribute('data-status', 'pending')
            assert receiver.snapshot()['state']['shifts'][-1]['status'] == 'submitted'
            manager.page.reload(wait_until='networkidle')
            manager.route('home')
            manager.page.locator(f'[data-count-id="{resumed_id}"]').first.click()
            manager.page.locator('#count-approve-form [name="adjustment"]').select_option('none')
            manager.page.locator('#count-approve-form [name="reason"]').fill('A megszámolt mennyiségek egyeznek, nincs készletjavítás.')
            manager.page.locator('#count-approve-form [name="reviewed"]').check()
            manager.submit('#count-approve-form')
            expect(manager.page.locator('#count-status')).to_have_attribute('data-status', 'done')
            assert manager.snapshot()['state']['shifts'][-1]['status'] == 'closed'
            report['checks'].append('A cancelled count can be started again, submitted by the assigned receiver and explicitly closed by the manager. Submitted counts do not silently adjust stock; the shift changes from open through counting and submitted to closed.')

            manager.capture(output, 'count-closed')
            manager.route('history')
            history = manager.page.locator('#history-list')
            assert cancelled_id in history.locator('[data-move-id]').evaluate_all('(els)=>els.map(el=>el.dataset.moveId)')
            history.locator(f'[data-move-id="{move_id}"]').first.click()
            expect(manager.page.locator('#move-status')).to_have_attribute('data-status', 'done')
            assert len(manager.page.locator('#move-timing time').all()) >= 3
            report['checks'].append('Closed and cancelled moves remain reachable from the personal audit trail with original timing and quantities.')

            manager.issue_form(quantity=2)
            wait_draft(manager, 'move-issue', 'quantity-0', '2')
            other_manager.page.reload(wait_until='networkidle')
            other_manager.route('issue')
            expect(other_manager.page.locator('[name="quantity-0"]')).to_have_value('2')
            manager.page.locator('[name="quantity-0"]').fill('3')
            wait_draft(manager, 'move-issue', 'quantity-0', '3')
            other_manager.page.locator('[name="quantity-0"]').fill('4')
            expect(other_manager.page.locator('#draft-conflict')).to_be_visible(timeout=8000)
            conflict = other_manager.page.locator('#draft-conflict').inner_text()
            assert '3' in conflict and '4' in conflict, conflict
            before_draft_choice = manager.snapshot()['revision']
            other_manager.capture(output, 'draft-conflict')
            other_manager.page.locator('[data-draft-choice="server"]').click()
            expect(other_manager.page.locator('#draft-conflict')).to_be_hidden()
            expect(other_manager.page.locator('[name="quantity-0"]')).to_have_value('3')
            assert manager.snapshot()['revision'] == before_draft_choice
            report['checks'].append('Two devices editing the same personal draft retain both versions and require an explicit server/device choice. Choosing the saved version restores its quantity without a stock command.')
        finally:
            for tablet in reversed(tablets):
                tablet.close()
            browser.close()
            server.stop()
    assert not report['script_errors'], report['script_errors']
    assert not report['external_requests'], report['external_requests']
    (output / 'foundations-browser.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.impeccable/review')
    parser.add_argument('--no-screenshots', action='store_true')
    args = parser.parse_args()
    check(args.output, capture=not args.no_screenshots)
