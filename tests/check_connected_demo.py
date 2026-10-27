#!/usr/bin/env python3
"""Check the connected sample inventory through its offline browser interface.

This is local demonstration evidence for BEV-02–06, MOZ-01–06, VISSZA-01–04,
SEL-01–02, LELT-02–08 and TORZS-01. It does not verify StoreHouse integration,
real authentication, durable drafts or the actual Codex preview configuration.
"""

import argparse
import json
from pathlib import Path
import re
import shutil

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / 'demo/raktar-bemutato-v5.html'
CSP = (
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; "
    "img-src data:; connect-src 'none'"
)
ROUTES = {
    'manager': ['home', 'stock', 'history', 'receipt', 'issue', 'return', 'count', 'help'],
    'receiver': ['home', 'stock', 'history', 'waste', 'count', 'help'],
}
WIDTHS = [1280, 1024, 768, 390]
SOURCE = 'Italraktár'
DESTINATION = 'Grill terasz'


def restricted_document(html):
    return html.replace(
        '<head>',
        '<head><meta http-equiv="Content-Security-Policy" content="' + CSP + '">',
        1,
    )


class Preview:
    """One independent sample session in an opaque-origin sandbox."""

    def __init__(self, context, html, report, standalone=False, clock_time=None):
        self.page = context.new_page()
        if clock_time is not None:
            self.page.clock.install(time=clock_time)
        self.page.on('pageerror', lambda error: report['script_errors'].append(str(error)))
        self.page.on('request', lambda request: (
            report['external_requests'].append(request.url)
            if request.url.startswith(('http:', 'https:')) else None
        ))
        if standalone:
            self.page.set_content(restricted_document(html))
            self.frame = self.page
        else:
            self.page.set_content(
                '<body style="margin:0"><iframe id="preview" sandbox="allow-scripts" '
                'style="border:0;width:100%;height:1800px" title="Demo preview"></iframe></body>'
            )
            self.page.locator('#preview').evaluate(
                '(frame, html) => { frame.srcdoc = html; }', restricted_document(html)
            )
            self.frame = self.page.frame_locator('#preview')
        self.frame.locator('#screen-title').wait_for(timeout=5000)

    def route(self, name):
        navigation = self.frame.locator(f'#nav [data-view="{name}"]')
        if navigation.count():
            navigation.click()
        else:
            self.frame.locator('#nav [data-view="home"]').click()
            self.frame.locator(f'#app [data-view="{name}"]').first.click()
        assert self.frame.locator('#screen-title').is_visible(), name

    def session_options(self, opened):
        options = self.frame.locator('.session-options')
        if (options.get_attribute('open') is not None) != opened:
            options.locator('summary').click()

    def role(self, name, location=None):
        self.session_options(True)
        self.frame.locator('#role-switch').select_option(name)
        if location:
            self.session_options(True)
            self.frame.locator('#location-switch').select_option(location)
        self.session_options(False)
        assert self.frame.locator('#actor-name').inner_text().strip()
        if location:
            assert location in self.frame.locator('.session').inner_text()

    def submit(self, selector):
        self.frame.locator(f'{selector} button[type="submit"]').click()

    def fill_line(self, index, product, quantity, unit='db', destination=None):
        while self.frame.locator('[data-line]').count() <= index:
            self.frame.locator('[data-action="add-line"]').click()
        self.frame.locator(f'[name="product-{index}"]').select_option(product)
        self.frame.locator(f'[name="quantity-{index}"]').fill(str(quantity))
        self.frame.locator(f'[name="unit-{index}"]').select_option(unit)
        if destination:
            self.frame.locator(f'[name="destination-{index}"]').select_option(destination)
            self.frame.locator(f'[name="checked-{index}"]').check()

    def stock(self, location):
        self.route('stock')
        self.frame.locator('#stock-location').select_option(location)
        rows = self.frame.locator('#stock-table tbody tr[data-product-id]')
        assert rows.count() >= 6, 'Shared product catalog missing from stock view.'
        values = {}
        for row in rows.all():
            cell = row.locator('[data-quantity]')
            value = float(cell.get_attribute('data-quantity'))
            shown = re.search(r'-?\d+(?:[,.]\d+)?', cell.inner_text())
            assert shown and float(shown.group().replace(',', '.')) == value, cell.inner_text()
            values[row.get_attribute('data-product-id')] = value
        return values

    def expect_stock(self, location, expected):
        actual = self.stock(location)
        assert actual.keys() == expected.keys(), (location, actual, expected)
        for product, quantity in expected.items():
            assert abs(actual[product] - quantity) < 0.000001, (location, product, actual[product], quantity)

    def open_record(self, kind, record_id):
        self.route('home')
        self.frame.locator(f'#app [data-{kind}-id="{record_id}"]').first.click()

    def status(self, kind, expected):
        status = self.frame.locator(f'#{kind}-status')
        assert status.get_attribute('data-status') == expected, status.inner_text()
        return status.get_attribute(f'data-{kind}-id')

    def history(self):
        self.route('history')
        return self.frame.locator('#history-list li[data-history-id]').all_inner_texts()

    def close(self):
        self.page.close()


def check_artifact(html):
    for filename in ['index.html', 'raktar-bemutato.html', 'raktar-bemutato-v2.html', 'raktar-bemutato-v3.html', 'raktar-bemutato-v4.html']:
        assert (ROOT / 'demo' / filename).read_text() == html, filename
    assert not re.search(r'<script\b[^>]*\bsrc\s*=', html, re.I), 'External script in standalone artifact.'
    assert not re.search(r'<script\b[^>]*\btype\s*=\s*[\"\']module', html, re.I), 'Module script needs an unavailable loader.'
    assert 'data:text/javascript' not in html and 'blob:' not in html


def receipt(preview, document='TEST-2026-17'):
    preview.route('receipt')
    assert preview.frame.locator('[name="product-0"]').input_value() == ''
    assert preview.frame.locator('[name="quantity-0"]').input_value() == ''
    preview.frame.locator('#receipt-form [name="supplier"]').fill('Próba beszállító')
    preview.frame.locator('#receipt-form [name="document"]').fill(document)
    preview.fill_line(0, 'water', 17, destination=SOURCE)
    preview.fill_line(1, 'cola', 7, destination=SOURCE)
    preview.fill_line(2, 'meat', 2.5, unit='kg', destination='Konyha')
    preview.submit('#receipt-form')
    assert preview.frame.locator('#feedback.error').count() == 0


def create_move(preview, kind, source, destination, lines):
    preview.route(kind)
    assert preview.frame.locator('[name="product-0"]').input_value() == ''
    assert preview.frame.locator('[name="quantity-0"]').input_value() == ''
    preview.frame.locator('#move-form [name="from"]').select_option(source)
    preview.frame.locator('#move-form [name="to"]').select_option(destination)
    for index, (product, amount, unit) in enumerate(lines):
        preview.fill_line(index, product, amount, unit)
    preview.submit('#move-form')
    return preview.status('move', 'pending')


def confirm_move(preview, location, amounts, enter=False):
    preview.frame.locator(f'[data-open-tablet="{location}"]').click()
    assert preview.frame.locator('#role-switch').input_value() == 'receiver'
    assert location in preview.frame.locator('.session').inner_text()
    for index, amount in enumerate(amounts):
        preview.frame.locator(f'#move-receive-form [name="received-{index}"]').fill(str(amount))
    if enter:
        preview.frame.locator('#move-receive-form [name="received-0"]').press('Enter')
    else:
        preview.submit('#move-receive-form')
    preview.status('move', 'done')
    assert preview.frame.locator('#feedback.error').count() == 0


def connected_workflow(preview, report):
    warehouse = preview.stock(SOURCE)
    destination = preview.stock(DESTINATION)
    kitchen = preview.stock('Konyha')
    assert preview.history() == [], 'A fresh demo must not contain invented completed work.'

    receipt(preview)
    warehouse['water'] += 17
    warehouse['cola'] += 7
    kitchen['meat'] += 2.5
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock('Konyha', kitchen)
    preview.expect_stock(DESTINATION, destination)
    assert len(preview.history()) == 1
    report['checks'].append('Receipt accepts chosen products and quantities across two destinations; only those shared stock rows increase.')

    move_id = create_move(preview, 'issue', SOURCE, DESTINATION, [('water', 12, 'db'), ('cola', 3, 'db')])
    warehouse['water'] -= 12
    warehouse['cola'] -= 3
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock(DESTINATION, destination)
    preview.open_record('move', move_id)
    preview.status('move', 'pending')
    assert preview.frame.locator('#move-receive-form').count() == 0, 'Manager cannot confirm as the local receiver.'
    confirm_move(preview, DESTINATION, [12, 3], enter=True)
    destination['water'] += 12
    destination['cola'] += 3
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock(DESTINATION, destination)
    assert len(preview.history()) == 3, 'Enter must submit the confirmation exactly once.'
    report['checks'].append('Issue of 12 water and 3 cola immediately reduces the source, waits separately, then increases the selected receiver only after confirmation; Enter executes once.')

    preview.role('manager')
    move_id = create_move(preview, 'return', DESTINATION, SOURCE, [('water', 2, 'db'), ('cola', 1, 'db')])
    destination['water'] -= 2
    destination['cola'] -= 1
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock(DESTINATION, destination)
    preview.open_record('move', move_id)
    confirm_move(preview, DESTINATION, [2, 1])
    warehouse['water'] += 2
    warehouse['cola'] += 1
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock(DESTINATION, destination)
    report['checks'].append('Return uses the same inventory, starts with the warehouse role, and the source receiver confirms the returned multiitem quantity.')

    preview.route('waste')
    preview.frame.locator('#waste-form [name="productId"]').select_option('water')
    preview.frame.locator('#waste-form [name="quantity"]').fill('1')
    preview.frame.locator('#waste-form [name="unit"]').select_option('db')
    preview.frame.locator('#waste-form [name="reason"]').fill('Eltört palack, a helyszínen ellenőrizve.')
    preview.submit('#waste-form')
    waste_id = preview.status('waste', 'pending')
    assert preview.frame.locator('#waste-approve-form').count() == 0
    preview.expect_stock(DESTINATION, destination)
    preview.role('manager')
    preview.open_record('waste', waste_id)
    preview.submit('#waste-approve-form')
    preview.status('waste', 'pending')
    preview.frame.locator('#waste-approve-form [name="reviewed"]').check()
    preview.submit('#waste-approve-form')
    preview.status('waste', 'done')
    destination['water'] -= 1
    preview.expect_stock(DESTINATION, destination)
    report['checks'].append('A local waste report leaves stock unchanged until the warehouse responsible person confirms review and finalizes it.')

    preview.role('receiver', DESTINATION)
    preview.route('count')
    preview.submit('#count-start-form')
    assert preview.frame.locator('#count-start-form').is_visible(), 'Counting requires a movement pause.'
    preview.frame.locator('#count-start-form [name="paused"]').check()
    preview.submit('#count-start-form')
    count_id = preview.status('count', 'counting')
    rows = preview.frame.locator('.count-row[data-product-id][data-expected]')
    assert rows.count() >= 5
    for row in rows.all():
        product = row.get_attribute('data-product-id')
        assert float(row.get_attribute('data-expected')) == destination[product], product
        assert row.locator(f'[name="actual-{product}"]').input_value() == ''
    preview.submit('#count-submit-form')
    preview.status('count', 'counting')
    for row in rows.all():
        product = row.get_attribute('data-product-id')
        actual = destination[product] - (1 if product == 'water' else 0)
        row.locator(f'[name="actual-{product}"]').fill(str(actual))
    preview.submit('#count-submit-form')
    preview.status('count', 'pending')
    assert preview.frame.locator('#count-approve-form').count() == 0
    preview.expect_stock(DESTINATION, destination)
    preview.role('manager')
    preview.open_record('count', count_id)
    assert preview.frame.locator('#count-approve-form [name="adjustment"]').input_value() == ''
    preview.frame.locator('#count-approve-form [name="reason"]').fill('Újraszámolva, egy palack hiánya megerősítve.')
    preview.frame.locator('#count-approve-form [name="reason"]').press('Enter')
    preview.status('count', 'pending')
    preview.frame.locator('#count-approve-form [name="reviewed"]').check()
    preview.submit('#count-approve-form')
    preview.status('count', 'pending')
    preview.frame.locator('#count-approve-form [name="adjustment"]').select_option('apply')
    preview.submit('#count-approve-form')
    preview.status('count', 'done')
    destination['water'] -= 1
    preview.expect_stock(DESTINATION, destination)
    preview.expect_stock(SOURCE, warehouse)
    history = preview.history()
    assert len(history) == 10, history
    history_text = '\n'.join(history)
    for detail in ['Próba beszállító', 'TEST-2026-17', SOURCE, DESTINATION, 'Eltört palack', 'Újraszámolva']:
        assert detail in history_text, detail
    report['checks'].append('Shift count expected values equal the shared stock after all preceding work; empty values are rejected, submission only waits for review, warehouse approval applies the one-unit difference, and history retains all 10 steps.')


def report_water_waste(preview):
    preview.route('waste')
    preview.frame.locator('#waste-form [name="productId"]').select_option('water')
    preview.frame.locator('#waste-form [name="quantity"]').fill('1')
    preview.frame.locator('#waste-form [name="unit"]').select_option('db')
    preview.frame.locator('#waste-form [name="reason"]').fill('A számolásban hiányzó egy palack törését ellenőriztük.')
    preview.submit('#waste-form')
    return preview.status('waste', 'pending')


def submit_shift_shortage(preview, expected, provisional=False):
    preview.route('count')
    preview.frame.locator('#count-start-form [name="paused"]').check()
    preview.submit('#count-start-form')
    count_id = preview.status('count', 'counting')
    if provisional:
        assert 'előzetes' in preview.frame.locator('.notice.warning').inner_text()
    for row in preview.frame.locator('.count-row[data-product-id][data-expected]').all():
        product = row.get_attribute('data-product-id')
        assert float(row.get_attribute('data-expected')) == expected[product]
        row.locator(f'[name="actual-{product}"]').fill(str(expected[product] - (1 if product == 'water' else 0)))
    preview.submit('#count-submit-form')
    preview.status('count', 'pending')
    if provisional:
        assert 'előzetes' in preview.frame.locator('.notice.warning').inner_text()
    return count_id


def prepare_count_without_correction(preview, count_id):
    preview.open_record('count', count_id)
    preview.frame.locator('#count-approve-form [name="adjustment"]').select_option('none')
    preview.frame.locator('#count-approve-form [name="reason"]').fill('A hiányzó palackot a kapcsolódó selejt már rendezte; nincs második levonás.')
    preview.frame.locator('#count-approve-form [name="reviewed"]').check()


def already_resolved_count(preview, report):
    expected = preview.stock(DESTINATION)
    preview.role('receiver', DESTINATION)
    count_id = submit_shift_shortage(preview, expected)
    preview.expect_stock(DESTINATION, expected)
    waste_id = report_water_waste(preview)
    preview.role('manager')
    preview.open_record('waste', waste_id)
    preview.frame.locator('#waste-approve-form [name="reviewed"]').check()
    preview.submit('#waste-approve-form')
    preview.status('waste', 'done')
    expected['water'] -= 1
    preview.expect_stock(DESTINATION, expected)
    prepare_count_without_correction(preview, count_id)
    preview.submit('#count-approve-form')
    preview.status('count', 'done')
    assert 'további készletváltoztatás nélkül' in preview.frame.locator('#app').inner_text()
    preview.expect_stock(DESTINATION, expected)
    assert len(preview.history()) == 5
    report['checks'].append('When waste recorded after count submission already resolves its one-unit shortage, the warehouse role closes the count with adjustment none and stock is not deducted twice; a correction choice has no default.')


def provisional_count(preview, report):
    expected = preview.stock(DESTINATION)
    preview.role('receiver', DESTINATION)
    waste_id = report_water_waste(preview)
    count_id = submit_shift_shortage(preview, expected, provisional=True)
    preview.expect_stock(DESTINATION, expected)
    preview.role('manager')
    prepare_count_without_correction(preview, count_id)
    preview.submit('#count-approve-form')
    preview.status('count', 'pending')
    assert preview.frame.locator('#feedback.error').is_visible()
    preview.expect_stock(DESTINATION, expected)
    preview.open_record('waste', waste_id)
    preview.frame.locator('#waste-approve-form [name="reviewed"]').check()
    preview.submit('#waste-approve-form')
    preview.status('waste', 'done')
    expected['water'] -= 1
    prepare_count_without_correction(preview, count_id)
    preview.submit('#count-approve-form')
    preview.status('count', 'done')
    preview.expect_stock(DESTINATION, expected)
    assert len(preview.history()) == 5
    report['checks'].append('An existing pending waste report permits starting and submitting a clearly provisional count; approval stays blocked until that report is resolved, then adjustment none closes without a second deduction.')


def separate_wine_return_rows(preview, report):
    warehouse = preview.stock(SOURCE)
    bar = preview.stock('Csárda pult')
    create_move(preview, 'return', 'Csárda pult', SOURCE, [('wine', 8, 'üveg'), ('wine', 3.5, 'dl')])
    bar['wine'] -= 6.35
    preview.expect_stock('Csárda pult', bar)
    preview.expect_stock(SOURCE, warehouse)
    preview.route('home')
    preview.frame.locator('#app [data-move-id]').click()
    preview.frame.locator('[data-open-tablet="Csárda pult"]').click()
    labels = preview.frame.locator('#move-receive-form label').all_inner_texts()
    assert len(labels) == 2 and labels[0] != labels[1], labels
    assert '1.' in labels[0] and '8 üveg' in labels[0] and 'liter' in labels[0], labels
    assert '2.' in labels[1] and '3,5 dl' in labels[1] and 'liter' in labels[1], labels
    preview.frame.locator('[name="received-0"]').fill('6')
    preview.frame.locator('[name="received-1"]').fill('0.35')
    preview.submit('#move-receive-form')
    preview.status('move', 'done')
    warehouse['wine'] += 6.35
    preview.expect_stock('Csárda pult', bar)
    preview.expect_stock(SOURCE, warehouse)
    for location in ['Fő raktár', SOURCE, 'Konyha']:
        preview.role('receiver', location)
        assert preview.frame.locator('#app [data-view="count"]').count() == 0, location
    preview.role('receiver', 'Csárda pult')
    assert preview.frame.locator('#app [data-view="count"]').is_visible()
    report['checks'].append('Returning 8 wine bottles and 3.5 dl keeps two distinct confirmation labels with their original units, converts to 6 plus 0.35 litres, and changes the shared stocks by 6.35 litres. Warehouse/kitchen receivers do not see a mandatory bar shift-count task.')


def invalid_inputs_and_partial_transfer(preview, report):
    warehouse = preview.stock(SOURCE)
    destination = preview.stock('Csárda pult')
    preview.route('receipt')
    preview.submit('#receipt-form')
    assert preview.frame.locator('#receipt-form').is_visible()
    preview.frame.locator('#receipt-form [name="supplier"]').fill('Ismétlés próba')
    preview.frame.locator('#receipt-form [name="document"]').fill('DUPLICATE-1')
    preview.fill_line(0, 'water', 1, destination=SOURCE)
    preview.frame.locator('[name="checked-0"]').uncheck()
    preview.submit('#receipt-form')
    assert preview.frame.locator('#receipt-form').is_visible()
    preview.frame.locator('[name="checked-0"]').check()
    preview.frame.locator('#receipt-form [name="document"]').press('Enter')
    warehouse['water'] += 1
    preview.expect_stock(SOURCE, warehouse)
    assert len(preview.history()) == 1
    preview.route('receipt')
    preview.frame.locator('#receipt-form [name="supplier"]').fill('Ismétlés próba')
    preview.frame.locator('#receipt-form [name="document"]').fill('DUPLICATE-1')
    preview.fill_line(0, 'water', 1, destination=SOURCE)
    preview.submit('#receipt-form')
    assert preview.frame.locator('#feedback.error').is_visible()
    preview.expect_stock(SOURCE, warehouse)
    assert len(preview.history()) == 1

    preview.route('issue')
    preview.frame.locator('#move-form [name="from"]').select_option(SOURCE)
    preview.frame.locator('#move-form [name="to"]').select_option(SOURCE)
    preview.fill_line(0, 'water', 4)
    preview.submit('#move-form')
    assert preview.frame.locator('#move-form').is_visible()
    preview.frame.locator('#move-form [name="to"]').select_option('Csárda pult')
    for invalid in ['', '-1', '1.5', str(int(warehouse['water']) + 1)]:
        preview.frame.locator('[name="quantity-0"]').fill(invalid)
        preview.submit('#move-form')
        assert preview.frame.locator('#move-form').is_visible(), invalid
    preview.frame.locator('[name="quantity-0"]').fill('4')
    preview.submit('#move-form')
    move_id = preview.status('move', 'pending')
    warehouse['water'] -= 4
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock('Csárda pult', destination)

    preview.role('receiver', DESTINATION)
    assert preview.frame.locator(f'#app [data-move-id="{move_id}"]').count() == 0, 'Another location must not receive this task.'
    for action in ['receipt', 'issue', 'return']:
        assert preview.frame.locator(f'#app [data-view="{action}"]').count() == 0
    preview.role('receiver', 'Csárda pult')
    preview.open_record('move', move_id)
    preview.submit('#move-receive-form')
    preview.status('move', 'pending')
    preview.frame.locator('#move-receive-form [name="received-0"]').fill('5')
    preview.submit('#move-receive-form')
    preview.status('move', 'pending')
    preview.frame.locator('#move-receive-form [name="received-0"]').fill('3')
    preview.frame.locator('#move-receive-form [name="received-0"]').press('Enter')
    preview.status('move', 'discrepancy')
    destination['water'] += 3
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock('Csárda pult', destination)
    preview.role('manager')
    preview.open_record('move', move_id)
    preview.submit('#move-resolve-form')
    preview.status('move', 'discrepancy')
    preview.frame.locator('#move-resolve-form [name="resolution"]').select_option('source')
    preview.frame.locator('#move-resolve-form [name="reason"]').fill('Egy palack a kiadó helyen maradt; közösen ellenőrizve.')
    preview.frame.locator('#move-resolve-form [name="reason"]').press('Enter')
    preview.status('move', 'discrepancy')
    preview.submit('#move-resolve-form')
    preview.status('move', 'done')
    warehouse['water'] += 1
    preview.expect_stock(SOURCE, warehouse)
    preview.expect_stock('Csárda pult', destination)
    assert len(preview.history()) == 4, 'Invalid inputs and retries must not record extra inventory changes.'
    report['checks'].append('Empty/unreviewed receipts, duplicate documents, same-location moves, negative/fractional/excess quantity and over-receipt are blocked; wrong-location receivers have no task. Partial 4/3 receipt leaves one pending, and an explained source correction restores it once without waste.')


def responsive_pages(preview, report):
    checked = []
    for width in WIDTHS:
        preview.page.set_viewport_size({'width': width, 'height': 900})
        for role, routes in ROUTES.items():
            preview.role(role, 'Csárda pult' if role == 'receiver' else None)
            for route in routes:
                preview.route(route)
                assert preview.frame.locator('html').evaluate('(el) => el.scrollWidth <= el.clientWidth + 1'), (width, role, route)
                for field in preview.frame.locator('#app input:not([type="hidden"]), #app select, #app textarea, #app button').all():
                    if field.is_visible():
                        bounds = field.bounding_box()
                        assert bounds and bounds['width'] > 0 and bounds['x'] >= -1 and bounds['x'] + bounds['width'] <= width + 1, (width, role, route, bounds)
                checked.append([width, role, route])
    report['responsive_pages'] = checked
    report['checks'].append('All accessible task, stock and history pages fit 1280, 1024, 768 and 390 pixels for both roles; hidden role-specific actions stay omitted.')


def sales_replay(preview, report):
    bar = preview.stock('Csárda pult')
    kitchen = preview.stock('Konyha')
    preview.frame.locator('.demo-controls summary').click()
    preview.frame.locator('#demo-sales').click()
    bar['cola'] -= 2
    bar['water'] -= 3
    kitchen['meat'] -= 0.36
    preview.expect_stock('Csárda pult', bar)
    preview.expect_stock('Konyha', kitchen)
    assert len(preview.history()) == 1
    preview.stock('Csárda pult')
    preview.frame.locator('.demo-controls summary').click()
    preview.frame.locator('#demo-sales').click()
    preview.expect_stock('Csárda pult', bar)
    preview.expect_stock('Konyha', kitchen)
    assert len(preview.history()) == 1
    preview.role('receiver', 'Csárda pult')
    preview.stock('Csárda pult')
    assert preview.frame.locator('#demo-sales').count() == 0
    report['checks'].append('The explicitly marked POS sample changes drink and recipe stock once; replaying the same sample changes neither inventory nor history, and the local receiver cannot launch it.')


def capture_walkthrough(context, html, output, report):
    # Chromium can omit painting the lower portion of a full-page screenshot of
    # an expanded nested iframe. Screenshots therefore use the same HTML directly.
    preview = Preview(context, html, report, standalone=True)

    def capture(name, width=1024):
        preview.page.set_viewport_size({'width': width, 'height': 900})
        # Heading focus may scroll the document. Reset that position so fixed
        # offscreen accessibility links stay outside the full-page capture.
        preview.page.evaluate('window.scrollTo(0, 0)')
        preview.page.screenshot(path=str(output / f'connected-{name}.png'), full_page=True)

    capture('home-tablet')
    preview.route('issue')
    capture('blank-issue-tablet')
    capture('blank-issue-mobile', 390)
    preview.page.set_viewport_size({'width': 1024, 'height': 900})
    create_move(preview, 'issue', SOURCE, DESTINATION, [('water', 12, 'db'), ('cola', 3, 'db')])
    capture('pending-move-tablet')
    preview.frame.locator(f'[data-open-tablet="{DESTINATION}"]').click()
    capture('receiver-task-tablet')
    capture('receiver-task-mobile', 390)
    for index, value in enumerate([12, 3]):
        preview.frame.locator(f'[name="received-{index}"]').fill(str(value))
    preview.submit('#move-receive-form')
    preview.status('move', 'done')
    preview.stock(DESTINATION)
    capture('stock-mobile', 390)
    capture('stock-tablet')
    preview.close()


def check(output):
    output.mkdir(parents=True, exist_ok=True)
    html = ARTIFACT.read_text()
    check_artifact(html)
    executable = shutil.which('chromium') or shutil.which('google-chrome')
    assert executable, 'Install Chromium or provide it on PATH.'
    report = {
        'scope': 'Local connected sample, offline allow-scripts iframe; actual Codex preview policy unknown.',
        'artifact': str(ARTIFACT.relative_to(ROOT)),
        'checks': [],
        'script_errors': [],
        'external_requests': [],
    }
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=executable, headless=True, args=['--no-sandbox']
        )
        context = browser.new_context(
            viewport={'width': 1024, 'height': 900}, offline=True, reduced_motion='reduce'
        )
        # Workflow checks below use visible controls and stock rows, never a
        # private JavaScript state object or a direct model invocation.
        for scenario in [connected_workflow, already_resolved_count, provisional_count, separate_wine_return_rows,
                         invalid_inputs_and_partial_transfer, sales_replay, responsive_pages]:
            preview = Preview(context, html, report)
            try:
                scenario(preview, report)
            finally:
                preview.close()
        capture_walkthrough(context, html, output, report)
        report['checks'].append('Classic standalone artifact runs with no external requests or script errors while offline under inline-only CSP and an allow-scripts sandbox.')
        context.close()
        browser.close()
    assert not report['script_errors'], report['script_errors']
    assert not report['external_requests'], report['external_requests']
    (output / 'connected-preview.json').write_text(json.dumps(report, ensure_ascii=False, indent=2))
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '.impeccable/review')
    check(parser.parse_args().output)
