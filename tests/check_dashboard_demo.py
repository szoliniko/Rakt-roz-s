#!/usr/bin/env python3
"""Check independent, timestamped dashboard tasks in the offline sample.

Local evidence for ALAP-06 and MOZ-09–11. The clock is controlled by Playwright;
the inventory and all transfer records are created through the visible UI.
"""

import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import shutil

from playwright.sync_api import sync_playwright

from check_connected_demo import ARTIFACT, ROOT, Preview, check_artifact, create_move, report_water_waste


START = datetime(2026, 10, 26, 23, 15, tzinfo=timezone.utc)
WAREHOUSE = 'Fő raktár'
BAR = 'Saloon'
OTHER_BAR = 'Grill terasz'


def make_preview(context, html, report, standalone=False):
    preview = Preview(context, html, report, standalone=standalone, clock_time=START - timedelta(minutes=1))
    preview.page.clock.pause_at(START)
    return preview


def metrics(preview, **expected):
    for name, value in expected.items():
        metric = preview.frame.locator(f'#dashboard-metrics [data-metric="{name}"]')
        assert int(metric.get_attribute('data-value')) == value, (name, metric.inner_text(), value)
        assert metric.locator('strong').inner_text() == str(value)


def row(preview, record_id):
    return preview.frame.locator(f'#transfer-groups .transfer-row[data-transfer-id="{record_id}"]')


def ids(preview, place=None):
    scope = '#transfer-groups' + (f' [data-place="{place}"]' if place else '')
    return preview.frame.locator(f'{scope} .transfer-row').evaluate_all('(rows) => rows.map(row => row.dataset.transferId)')


def times(locator):
    return [datetime.fromisoformat(item.get_attribute('datetime').replace('Z', '+00:00')) for item in locator.locator('time').all()]


def filter_by(preview, name):
    preview.frame.locator(f'[data-transfer-filter="{name}"]').click()
    assert preview.frame.locator(f'[data-transfer-filter="{name}"]').get_attribute('aria-pressed') == 'true'


def advance_to(preview, moment):
    current_ms = preview.page.evaluate('Date.now()')
    delta_ms = round(moment.timestamp() * 1000 - current_ms)
    assert delta_ms >= 0, (moment, current_ms)
    preview.page.clock.fast_forward(delta_ms)


def dashboard_workflow(preview, report, capture=None):
    warehouse = preview.stock(WAREHOUSE)
    bar = preview.stock(BAR)
    other = preview.stock(OTHER_BAR)
    assert preview.history() == []
    first = create_move(preview, 'issue', WAREHOUSE, BAR, [('water', 7, 'db')])
    detail = preview.frame.locator('#move-timing')
    assert START in times(detail)
    assert START + timedelta(minutes=30) in times(detail)
    assert '2026. 10. 27.' in detail.inner_text() and '00:15' in detail.inner_text(), detail.inner_text()
    advance_to(preview, START + timedelta(minutes=2))
    second = create_move(preview, 'issue', WAREHOUSE, BAR, [('cola', 5, 'db'), ('beer', 2, 'db')])
    assert first != second
    preview.route('home')
    metrics(preview, pending=2, overdue=0, discrepancy=0, other=0)
    assert ids(preview, BAR) == [first, second], 'Independent records must be oldest first within their confirmation place.'
    assert times(row(preview, first))[0] == START
    assert times(row(preview, second))[0] == START + timedelta(minutes=2)
    assert '10. 27.' in row(preview, first).inner_text() and '00:15' in row(preview, first).inner_text()
    assert 'Ásványvíz: 7 darab' in row(preview, first).inner_text()
    assert 'Kóla: 5 darab' in row(preview, second).inner_text()
    assert 'Palackos sör: 2 darab' in row(preview, second).inner_text()
    references = [row(preview, record_id).locator('h3').inner_text().split(' · ')[0] for record_id in [first, second]]
    assert references[0] != references[1]
    for record_id in [first, second]:
        assert BAR in row(preview, record_id).locator('.next-step').inner_text()
        assert 'átvevője' in row(preview, record_id).locator('.next-step').inner_text()
    if capture:
        capture('normal')

    preview.route('issue')
    preview.frame.locator('#move-form [name="from"]').select_option(WAREHOUSE)
    preview.frame.locator('#move-form [name="to"]').select_option(BAR)
    preview.fill_line(0, 'water', 2)
    backlog = preview.frame.locator('#move-backlog')
    assert '2 nyitott átadás' in backlog.inner_text()
    assert all(reference in backlog.inner_text() for reference in references)
    if capture:
        capture('issue-warning')
    quantity = preview.frame.locator('[name="quantity-0"]')
    quantity.focus()
    preview.page.clock.run_for(10000)
    assert preview.frame.locator('body').evaluate('() => document.activeElement.name') == 'quantity-0'
    assert quantity.input_value() == '2'
    assert preview.frame.locator('[name="product-0"]').input_value() == 'water'
    assert preview.frame.locator('[name="unit-0"]').input_value() == 'db'
    preview.frame.locator('#move-form [name="to"]').select_option(OTHER_BAR)
    assert backlog.inner_text() == ''
    assert quantity.input_value() == '2'
    preview.frame.locator('#move-form [name="to"]').select_option(BAR)
    assert all(reference in backlog.inner_text() for reference in references)
    assert quantity.input_value() == '2'
    preview.submit('#move-form')
    third = preview.status('move', 'pending')
    fourth = create_move(preview, 'issue', WAREHOUSE, OTHER_BAR, [('beer', 1, 'db')])
    assert len({first, second, third, fourth}) == 4
    warehouse['water'] -= 9
    warehouse['cola'] -= 5
    warehouse['beer'] -= 3
    preview.expect_stock(WAREHOUSE, warehouse)
    preview.expect_stock(BAR, bar)
    preview.expect_stock(OTHER_BAR, other)
    assert len(preview.history()) == 4

    preview.route('home')
    metrics(preview, pending=4, overdue=0, discrepancy=0, other=0)
    advance_to(preview, START + timedelta(minutes=29, seconds=59))
    metrics(preview, overdue=0)
    assert 'is-overdue' not in (row(preview, first).get_attribute('class') or '')
    row(preview, first).locator('button').focus()
    # The model boundary is exactly 30 minutes; the visible timer refreshes at
    # most every 10 seconds. Cross it without navigating or clicking refresh.
    preview.page.clock.run_for(11000)
    metrics(preview, pending=4, overdue=1, discrepancy=0)
    assert preview.frame.locator('body').evaluate('() => document.activeElement.dataset.moveId') == first
    assert 'is-overdue' in row(preview, first).get_attribute('class')
    assert row(preview, first).locator('.badge.overdue').inner_text() == 'Késik a visszaigazolás'
    assert row(preview, first).locator('.badge.overdue').evaluate('(el) => getComputedStyle(el).color') != row(preview, second).locator('.badge').evaluate('(el) => getComputedStyle(el).color')
    assert times(row(preview, first))[0] == START, 'Elapsed time must not replace the original timestamp.'
    if capture:
        capture('overdue')
    filter_by(preview, 'overdue')
    assert ids(preview) == [first]
    filter_by(preview, 'discrepancy')
    assert ids(preview) == []
    filter_by(preview, 'all')
    assert set(ids(preview)) == {first, second, third, fourth}
    preview.expect_stock(WAREHOUSE, warehouse)
    preview.expect_stock(BAR, bar)
    preview.expect_stock(OTHER_BAR, other)
    assert len(preview.history()) == 4, 'Clock ticks must not record inventory work.'

    preview.role('receiver', BAR)
    metrics(preview, pending=3, overdue=1, discrepancy=0, other=0)
    assert ids(preview) == [first, second, third]
    if capture:
        capture('receiver')
    preview.open_record('move', first)
    preview.frame.locator('#move-receive-form [name="received-0"]').fill('7')
    preview.frame.locator('#move-receive-form [name="received-0"]').press('Enter')
    preview.status('move', 'done')
    assert preview.frame.locator('#move-receive-form').count() == 0
    assert START + timedelta(minutes=30, seconds=10) in times(preview.frame.locator('#move-timing'))
    bar['water'] += 7
    preview.expect_stock(BAR, bar)
    assert len(preview.history()) == 5, 'Confirmation must execute exactly once.'
    preview.route('home')
    metrics(preview, pending=2, overdue=0, discrepancy=0)
    assert ids(preview) == [second, third], 'Confirming one record must leave the others open.'

    preview.open_record('move', second)
    preview.frame.locator('[name="received-0"]').fill('4')
    preview.frame.locator('[name="received-1"]').fill('2')
    preview.submit('#move-receive-form')
    preview.status('move', 'discrepancy')
    bar['cola'] += 4
    bar['beer'] += 2
    preview.expect_stock(BAR, bar)
    preview.route('home')
    advance_to(preview, START + timedelta(minutes=35, seconds=10))
    metrics(preview, pending=1, overdue=1, discrepancy=1, other=0)
    assert 'is-overdue' not in row(preview, second).get_attribute('class')
    assert 'raktárfelelős' in row(preview, second).locator('.next-step').inner_text()
    assert row(preview, second).locator('.badge.overdue').count() == 0
    filter_by(preview, 'overdue')
    assert ids(preview) == [third]
    filter_by(preview, 'discrepancy')
    assert ids(preview) == [second]
    filter_by(preview, 'all')
    preview.role('manager')
    metrics(preview, pending=2, overdue=2, discrepancy=1, other=0)
    if capture:
        capture('discrepancy')
    preview.open_record('move', second)
    preview.frame.locator('#move-resolve-form [name="resolution"]').select_option('source')
    preview.frame.locator('#move-resolve-form [name="reason"]').fill('Egy kóla a Fő raktárban maradt; a Saloon átvevőjével egyeztetve.')
    preview.submit('#move-resolve-form')
    preview.status('move', 'done')
    assert preview.frame.locator('#move-resolve-form').count() == 0
    detail_times = times(preview.frame.locator('#move-timing'))
    for expected_time in [START + timedelta(minutes=2), START + timedelta(minutes=30, seconds=10), START + timedelta(minutes=35, seconds=10)]:
        assert expected_time in detail_times, detail_times
    warehouse['cola'] += 1
    preview.expect_stock(WAREHOUSE, warehouse)
    preview.expect_stock(BAR, bar)
    assert len(preview.history()) == 7
    history_link = preview.frame.locator(f'#history-list [data-move-id="{second}"]').first
    assert history_link.is_visible(), 'Completed records must remain reachable from their own history entry.'
    history_link.click()
    preview.status('move', 'done')
    assert times(preview.frame.locator('#move-timing')) == detail_times
    assert 'Kóla' in preview.frame.locator('#app').inner_text()
    assert preview.frame.locator('#move-receive-form, #move-resolve-form').count() == 0
    preview.route('home')
    metrics(preview, pending=2, overdue=2, discrepancy=0, other=0)

    preview.role('receiver', BAR)
    report_water_waste(preview)
    preview.route('home')
    metrics(preview, other=1)
    preview.role('receiver', OTHER_BAR)
    metrics(preview, pending=1, overdue=1, discrepancy=0, other=0)
    assert ids(preview) == [fourth]
    preview.role('manager')
    metrics(preview, pending=2, overdue=2, discrepancy=0, other=1)
    preview.expect_stock(BAR, bar)
    assert len(preview.history()) == 8
    report['checks'].extend([
        'Same-place issues retain independent references, quantities, timestamps and oldest-first ordering; their source and receiver stock effects remain separate.',
        'The third issue warns about existing records, permits a new shipment, updates for destination changes and preserves edited fields and focus during timed refresh.',
        'At 29:59 the first issue is not late; by the first refresh after 30:00 it turns red with explicit late text automatically. Clock passage changes neither inventory, records nor original timestamps.',
        'Created, confirmed and resolved timestamps retain UTC instants and display Budapest time, including the next calendar day while the browser timezone is UTC.',
        'Late and discrepancy filters, receiver place scoping and other-task counters match visible records; confirming one issue closes only that issue and does not execute twice.',
        'Partial confirmation becomes a warehouse discrepancy, never another late receiver confirmation; the source correction applies once, and the closed history link reopens the same quantities and all three event timestamps without another confirmation control.',
    ])


def manual_clock(preview, report):
    warehouse = preview.stock(WAREHOUSE)
    bar = preview.stock(BAR)
    record_id = create_move(preview, 'issue', WAREHOUSE, BAR, [('water', 1, 'db')])
    created_at = times(preview.frame.locator('#move-timing'))[0]
    warehouse['water'] -= 1
    preview.route('help')
    control = preview.frame.locator('[data-action="advance-demo-clock"]')
    control.locator('xpath=ancestor::details').locator('summary').click()
    control.click()
    metrics(preview, pending=1, overdue=1, discrepancy=0, other=0)
    assert '31' in preview.frame.locator('#demo-clock-notice').inner_text()
    assert times(row(preview, record_id))[0] == created_at
    preview.expect_stock(WAREHOUSE, warehouse)
    preview.expect_stock(BAR, bar)
    assert len(preview.history()) == 1
    report['checks'].append('The help-only +31 minute demonstration control marks the existing issue late, visibly labels the advanced clock and leaves stock, confirmations and history unchanged.')


def check(output):
    output.mkdir(parents=True, exist_ok=True)
    html = ARTIFACT.read_text()
    check_artifact(html)
    report = {
        'scope': 'Offline standalone dashboard with inline-only CSP and a Playwright-controlled clock; help clock separately checked in an allow-scripts iframe. No real integration or actual Codex viewer claim.',
        'artifact': str(ARTIFACT.relative_to(ROOT)),
        'checks': [], 'script_errors': [], 'external_requests': [], 'screenshots': [],
    }
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path=shutil.which('chromium'), headless=True, args=['--no-sandbox'])
        context = browser.new_context(viewport={'width': 1024, 'height': 900}, offline=True, reduced_motion='reduce', timezone_id='UTC')
        # Playwright installs its fake Date in opaque srcdoc frames, but later
        # pause/advance commands only control the host clock. Check the public
        # help clock in that sandbox; use the standalone document for exact
        # deadline and timezone checks, with the same offline CSP.
        preview = Preview(context, html, report)
        try:
            manual_clock(preview, report)
        finally:
            preview.close()
        visual = make_preview(context, html, report, standalone=True)

        def capture(name):
            for width, label in [(1024, 'tablet'), (390, 'mobile')]:
                visual.page.set_viewport_size({'width': width, 'height': 900})
                assert visual.frame.locator('html').evaluate('(el) => el.scrollWidth <= el.clientWidth + 1'), (name, width)
                visual.page.evaluate('window.scrollTo(0, 0)')
                filename = f'dashboard-{name}-{label}.png'
                visual.page.screenshot(path=str(output / filename), full_page=True)
                report['screenshots'].append(filename)
            visual.page.set_viewport_size({'width': 1024, 'height': 900})

        try:
            dashboard_workflow(visual, report, capture)
        finally:
            visual.close()
        context.close()
        browser.close()
    assert not report['script_errors'], report['script_errors']
    assert not report['external_requests'], report['external_requests']
    report['checks'].append('Both workflows initialize offline under inline-only CSP with no script errors or external requests; populated dashboard states fit 1024 and 390 pixels.')
    (output / 'dashboard-preview.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.impeccable/review')
    check(parser.parse_args().output)
