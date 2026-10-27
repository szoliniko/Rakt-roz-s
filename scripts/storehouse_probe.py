#!/usr/bin/env python3
"""Read-only, unauthenticated sh5info probe; no customer connection is assumed."""

from __future__ import annotations

import argparse
import json
import math
import queue
import re
import socket
import ssl
import threading
from urllib import error, parse, request


SCOPE = "unauthenticated_sh5info_only"
CONTRACT = "provided_document_sample_not_vendor_or_installation_verified"
DEFAULT_RESPONSE_LIMIT = 65_536
VERSION_PATTERN = re.compile(r"v?\d+(?:\.\d+){0,7}(?:[-+]\d+(?:\.\d+)*)?", re.ASCII)


def result(status: str, **details: object) -> dict:
    return {
        "status": status,
        "scope": SCOPE,
        "contract": CONTRACT,
        "production_readiness": "not_established",
        **details,
    }


def endpoint_for(base_url: str) -> str:
    """Accept an explicit HTTP(S) origin, never credentials or an arbitrary path."""
    if not base_url or any(c.isspace() or ord(c) < 32 for c in base_url):
        raise ValueError("base_url_must_be_an_explicit_http_or_https_origin")
    try:
        parts = parse.urlsplit(base_url)
        host = parts.hostname
        port = parts.port
    except ValueError:
        raise ValueError("invalid_base_url") from None
    if (
        parts.scheme not in {"http", "https"}
        or not host
        or parts.username is not None
        or parts.password is not None
        or parts.path not in {"", "/"}
        or parts.query
        or parts.fragment
        or any(c in parts.netloc for c in "\\%?#")
        or (port is not None and not 1 <= port <= 65535)
    ):
        raise ValueError("base_url_must_be_an_origin_without_credentials_path_query_or_fragment")
    return parse.urlunsplit((parts.scheme, parts.netloc, "/api/sh5info", "", ""))


class NoRedirects(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def json_type(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, dict):
        return "object"
    if isinstance(value, list):
        return "array"
    if isinstance(value, str):
        return "string"
    if isinstance(value, int):
        return "integer"
    return "number"


def response_shape(value: object) -> dict:
    """Classify unknown schemas without echoing arbitrary keys or values."""
    shape = {"type": json_type(value)}
    if isinstance(value, dict):
        known = {key: json_type(value[key]) for key in ("errorCode", "errMessage", "Version") if key in value}
        shape["known_fields"] = known
        shape["additional_field_count"] = len(value) - len(known)
    elif isinstance(value, list):
        shape["item_count"] = len(value)
    return shape


def _unique_object(pairs):
    obj = {}
    for key, value in pairs:
        if key in obj:
            raise ValueError("duplicate_json_key")
        obj[key] = value
    return obj


def _reject_constant(value):
    raise ValueError("non_finite_json_number")


def inspect_body(body: bytes, http_status: int) -> dict:
    try:
        value = json.loads(
            body.decode("utf-8-sig"),
            object_pairs_hook=_unique_object,
            parse_constant=_reject_constant,
        )
    except (UnicodeError, ValueError, RecursionError):
        return result("invalid_json", http_status=http_status)

    details = {"http_status": http_status, "response_shape": response_shape(value)}
    if not isinstance(value, dict):
        return result("unrecognized_response", **details)
    code = value.get("errorCode")
    if type(code) is not int or not -(2**31) <= code < 2**31:
        return result("unrecognized_response", **details)
    details["error_code"] = code
    if code != 0:
        return result("application_error", **details)
    version = value.get("Version")
    if value.get("errMessage") != "OK" or not isinstance(version, str) or not version.strip():
        return result("unrecognized_response", **details)

    # Do not print arbitrary server text as a version: it might contain secrets.
    if len(version) <= 64 and VERSION_PATTERN.fullmatch(version):
        details["version"] = version
    else:
        details["version_value"] = "withheld_unrecognized_version_format"
    return result("sample_shape_matched", **details)


def _http_probe(endpoint: str, timeout: float, response_limit: int, context: ssl.SSLContext) -> dict:
    opener = request.build_opener(NoRedirects(), request.HTTPSHandler(context=context))
    req = request.Request(
        endpoint,
        method="GET",
        headers={"Accept": "application/json", "Accept-Encoding": "identity", "User-Agent": "storehouse-sh5info-probe/0.1"},
    )
    try:
        with opener.open(req, timeout=timeout) as response:
            status = response.status
            if 300 <= status < 400:
                return result("redirect_blocked", http_status=status)
            if status != 200:
                return result("unexpected_http_status", http_status=status)
            if response.headers.get("Content-Encoding", "identity").lower() != "identity":
                return result("unsupported_content_encoding", http_status=status)
            body = response.read(response_limit + 1)
            if len(body) > response_limit:
                return result("response_too_large", http_status=status)
            return inspect_body(body, status)
    except error.HTTPError as exc:
        status = exc.code
        exc.close()
        return result("redirect_blocked" if 300 <= status < 400 else "http_error", http_status=status)
    except error.URLError as exc:
        if isinstance(exc.reason, ssl.SSLCertVerificationError):
            return result("tls_verification_failed")
        if isinstance(exc.reason, (TimeoutError, socket.timeout)):
            return result("timeout")
        return result("connection_failed")
    except ssl.SSLCertVerificationError:
        return result("tls_verification_failed")
    except (TimeoutError, socket.timeout):
        return result("timeout")
    except (OSError, ValueError):
        return result("transport_error")


def probe(base_url: str, *, timeout: float = 5.0, response_limit: int = DEFAULT_RESPONSE_LIMIT, ca_file: str | None = None) -> dict:
    try:
        endpoint = endpoint_for(base_url)
        if not math.isfinite(timeout) or not 0.1 <= timeout <= 30:
            raise ValueError("timeout_must_be_between_0.1_and_30_seconds")
        if type(response_limit) is not int or not 1 <= response_limit <= 1_048_576:
            raise ValueError("response_limit_must_be_between_1_and_1048576_bytes")
        context = ssl.create_default_context(cafile=ca_file)
    except ValueError as exc:
        # Only our fixed validation messages are emitted, never URL/credential data.
        code = str(exc) if str(exc) in {
            "base_url_must_be_an_explicit_http_or_https_origin",
            "invalid_base_url",
            "base_url_must_be_an_origin_without_credentials_path_query_or_fragment",
            "timeout_must_be_between_0.1_and_30_seconds",
            "response_limit_must_be_between_1_and_1048576_bytes",
        } else "invalid_tls_configuration"
        return result("configuration_error", reason=code)
    except (OSError, ssl.SSLError):
        return result("configuration_error", reason="cannot_load_trusted_ca")

    completed = queue.Queue(maxsize=1)

    def run_request():
        try:
            outcome = _http_probe(endpoint, timeout, response_limit, context)
        except Exception:
            # Do not emit a traceback containing server text or connection details.
            outcome = result("transport_error")
        completed.put(outcome)

    # A daemon worker bounds CLI waiting even during DNS or a trickling response.
    # The CLI exits after a timeout; it never sends a retry or a second request.
    threading.Thread(target=run_request, daemon=True).start()
    try:
        return completed.get(timeout=timeout)
    except queue.Empty:
        return result("timeout")


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(
        description="Read-only StoreHouse /api/sh5info check using the supplied document's unverified sample contract. No authentication, retries or writes.",
    )
    parser.add_argument("--base-url", required=True, help="Explicit HTTP(S) origin supplied by the operator, including the actual port if needed; no path, credentials, query or fragment.")
    parser.add_argument("--timeout", type=float, default=5.0, help="Maximum wait in seconds (0.1–30; default: 5).")
    parser.add_argument("--max-response-bytes", type=int, default=DEFAULT_RESPONSE_LIMIT, help="Response size limit (1–1048576; default: 65536).")
    parser.add_argument("--ca-file", type=str, help="Optional PEM file containing the trusted CA for the actual HTTPS service. TLS verification remains enabled.")
    args = parser.parse_args(argv)
    outcome = probe(args.base_url, timeout=args.timeout, response_limit=args.max_response_bytes, ca_file=args.ca_file)
    print(json.dumps(outcome, ensure_ascii=False, sort_keys=True))
    if outcome["status"] == "sample_shape_matched":
        return 0
    return 2 if outcome["status"] == "configuration_error" else 1


if __name__ == "__main__":
    raise SystemExit(main())
