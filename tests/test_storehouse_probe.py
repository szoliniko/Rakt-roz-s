"""Local HTTP transport checks; these do not establish a StoreHouse connection."""

from contextlib import contextmanager, redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import threading
import time
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "storehouse_probe.py"
SPEC = importlib.util.spec_from_file_location("storehouse_probe", SCRIPT)
probe = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(probe)
SAMPLE = {"errorCode": 0, "errMessage": "OK", "Version": "5.123.4"}


@contextmanager
def http_server(body=None, *, status=200, headers=None, delay=0, chunk_delay=0):
    events = []
    payload = json.dumps(SAMPLE if body is None else body).encode() if not isinstance(body, bytes) else body

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            events.append({"method": self.command, "path": self.path, "headers": dict(self.headers)})
            time.sleep(delay)
            self.send_response(status)
            for name, value in (headers or {}).items():
                self.send_header(name, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            try:
                if chunk_delay:
                    for byte in payload:
                        self.wfile.write(bytes([byte]))
                        self.wfile.flush()
                        time.sleep(chunk_delay)
                else:
                    self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                pass

        def do_POST(self):
            events.append({"method": self.command, "path": self.path})
            self.send_error(405)

        def log_message(self, *args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    worker = threading.Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", events
    finally:
        server.shutdown()
        server.server_close()
        worker.join(timeout=2)


class ProbeTransportTests(unittest.TestCase):
    def setUp(self):
        # Deterministic loopback tests independent of the caller's proxy settings.
        self.proxy_patch = patch.dict("os.environ", {"no_proxy": "127.0.0.1", "NO_PROXY": "127.0.0.1"})
        self.proxy_patch.start()
        self.addCleanup(self.proxy_patch.stop)

    def test_only_one_unauthenticated_get_to_sh5info(self):
        with http_server() as (base, events):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "sample_shape_matched")
        self.assertEqual(outcome["version"], "5.123.4")
        self.assertEqual(outcome["production_readiness"], "not_established")
        self.assertEqual(len(events), 1)
        self.assertEqual((events[0]["method"], events[0]["path"]), ("GET", "/api/sh5info"))
        self.assertNotIn("Authorization", events[0]["headers"])
        self.assertNotIn("Content-Length", events[0]["headers"])

    def test_cross_host_redirect_is_not_followed(self):
        with http_server() as (target, target_events):
            location = target.replace("127.0.0.1", "localhost") + "/api/sh5exec"
            with http_server(status=302, headers={"Location": location}) as (base, events):
                outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "redirect_blocked")
        self.assertEqual(len(events), 1)
        self.assertEqual(target_events, [])
        self.assertNotIn("Location", json.dumps(outcome))

    def test_same_host_redirect_is_also_not_followed(self):
        with http_server(status=307, headers={"Location": "/api/sh5exec"}) as (base, events):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "redirect_blocked")
        self.assertEqual(len(events), 1)

    def test_http_error_does_not_echo_server_body(self):
        with http_server(b"password=SECRET diagnostic details", status=401) as (base, events):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "http_error")
        self.assertEqual(outcome["http_status"], 401)
        self.assertNotIn("SECRET", json.dumps(outcome))
        self.assertEqual(len(events), 1)

    def test_application_error_does_not_echo_message(self):
        with http_server({"errorCode": 42, "errMessage": "SECRET", "Version": "5.0"}) as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "application_error")
        self.assertEqual(outcome["error_code"], 42)
        self.assertNotIn("SECRET", json.dumps(outcome))

    def test_http_200_html_is_not_a_success(self):
        with http_server(b"<html>Login page</html>") as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "invalid_json")

    def test_unknown_json_is_classified_without_echoing_keys_or_values(self):
        with http_server({"secret_field_name": "SECRET"}) as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "unrecognized_response")
        self.assertEqual(outcome["response_shape"]["additional_field_count"], 1)
        self.assertNotIn("secret_field_name", json.dumps(outcome))
        self.assertNotIn("SECRET", json.dumps(outcome))

    def test_wrong_version_shape_is_preserved_as_type(self):
        with http_server({**SAMPLE, "Version": {"api": "5.0"}}) as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "unrecognized_response")
        self.assertEqual(outcome["response_shape"]["known_fields"]["Version"], "object")

    def test_arbitrary_version_text_is_not_logged(self):
        with http_server({**SAMPLE, "Version": "5.0 SECRET"}) as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "sample_shape_matched")
        self.assertEqual(outcome["version_value"], "withheld_unrecognized_version_format")
        self.assertNotIn("SECRET", json.dumps(outcome))

    def test_bool_error_code_is_not_integer_success(self):
        with http_server({**SAMPLE, "errorCode": False}) as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "unrecognized_response")

    def test_duplicate_json_keys_are_rejected(self):
        with http_server(b'{"errorCode": 7, "errorCode": 0, "errMessage": "OK", "Version": "5.0"}') as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "invalid_json")

    def test_response_limit_is_enforced(self):
        with http_server(b"x" * 1024) as (base, _):
            outcome = probe.probe(base, response_limit=64)
        self.assertEqual(outcome["status"], "response_too_large")

    def test_compressed_response_is_not_decompressed(self):
        with http_server(b"compressed payload", headers={"Content-Encoding": "gzip"}) as (base, _):
            outcome = probe.probe(base)
        self.assertEqual(outcome["status"], "unsupported_content_encoding")

    def test_timeout_is_bounded_without_retries(self):
        with http_server(delay=0.6) as (base, events):
            started = time.monotonic()
            outcome = probe.probe(base, timeout=0.15)
            elapsed = time.monotonic() - started
        self.assertEqual(outcome["status"], "timeout")
        self.assertLess(elapsed, 0.5)
        self.assertEqual(len(events), 1)

    def test_continuous_slow_response_cannot_extend_total_wait(self):
        with http_server(b"x" * 20, chunk_delay=0.04) as (base, events):
            started = time.monotonic()
            outcome = probe.probe(base, timeout=0.18)
            elapsed = time.monotonic() - started
        self.assertEqual(outcome["status"], "timeout")
        self.assertLess(elapsed, 0.5)
        self.assertEqual(len(events), 1)

    def test_url_credentials_arbitrary_paths_and_unsafe_schemes_rejected_before_request(self):
        bad_urls = [
            "customer-host:9797", "file:///etc/passwd", "ftp://example.org", "https://user:SECRET@example.org",
            "https://example.org/api/sh5exec", "https://example.org?Password=SECRET", "https://example.org#SECRET",
            "https://example.org:0", "https://example.org:99999", "https://example.org\n", "https://example.org\\bad",
        ]
        with patch.object(probe.request, "build_opener") as transport:
            for url in bad_urls:
                with self.subTest(url=url):
                    outcome = probe.probe(url)
                    self.assertEqual(outcome["status"], "configuration_error")
                    self.assertNotIn("SECRET", json.dumps(outcome))
        transport.assert_not_called()

    def test_tls_context_uses_verification_and_accepts_custom_ca(self):
        real_context = probe.ssl.create_default_context()
        self.assertTrue(real_context.check_hostname)
        self.assertEqual(real_context.verify_mode, probe.ssl.CERT_REQUIRED)
        with patch.object(probe.ssl, "create_default_context", return_value=real_context) as factory:
            with http_server() as (base, _):
                outcome = probe.probe(base, ca_file="trusted-private-ca.pem")
        factory.assert_called_once_with(cafile="trusted-private-ca.pem")
        self.assertEqual(outcome["status"], "sample_shape_matched")

    def test_missing_ca_fails_before_network(self):
        with patch.object(probe.request, "build_opener") as transport:
            outcome = probe.probe("https://example.org", ca_file="/definitely-missing-private-ca.pem")
        self.assertEqual(outcome["status"], "configuration_error")
        transport.assert_not_called()

    def test_cli_prints_structured_result_and_exit_code(self):
        with http_server() as (base, _), redirect_stdout(io.StringIO()) as output:
            status = probe.main(["--base-url", base])
        self.assertEqual(status, 0)
        self.assertEqual(json.loads(output.getvalue())["status"], "sample_shape_matched")

    def test_cli_requires_explicit_url(self):
        completed = subprocess.run([sys.executable, str(SCRIPT)], capture_output=True, text=True)
        self.assertEqual(completed.returncode, 2)
        self.assertIn("--base-url", completed.stderr)


if __name__ == "__main__":
    unittest.main()
