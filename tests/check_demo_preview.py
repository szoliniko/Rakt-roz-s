#!/usr/bin/env python3
"""Compatibility entry point for the current connected-demo browser checks.

The former independent scenario UI was replaced. Keep this documented command
pointing to the checks for the artifact that is actually generated now.
"""
from pathlib import Path
import runpy

if __name__ == '__main__':
    runpy.run_path(str(Path(__file__).with_name('check_connected_demo.py')), run_name='__main__')
