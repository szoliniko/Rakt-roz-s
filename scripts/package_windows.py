#!/usr/bin/env python3
"""Build a portable Windows ZIP from reviewed sources and verified Node runtimes.

python3 scripts/package_windows.py --runtime-dir /tmp/.../runtime \
    --output /workspace/Raktar-Windows.zip

No installed databases, session cookies, Git metadata or private drafts are copied.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]


def sha256(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def build(runtime, output):
    records = json.loads((runtime / 'PROVENANCE.json').read_text())
    hashes = dict(line.split(maxsplit=1)[::-1]
                  for line in (runtime / 'SHASUMS256.txt').read_text().splitlines() if line.strip())
    files = {}
    for arch, machine in [('x64', 0x8664), ('arm64', 0xAA64)]:
        record = next(row for row in records if row['architecture'] == arch)
        archive = f"node-{record['version']}-win-{arch}.zip"
        if record['source'] != f"https://nodejs.org/dist/{record['version']}/{archive}":
            raise ValueError('Unexpected Node.js distribution source')
        if hashes.get(archive) != record['archiveSha256']:
            raise ValueError(f'Archive checksum record differs: {arch}')
        exe = runtime / f'win-{arch}' / 'node.exe'
        if sha256(exe) != record['nodeSha256']:
            raise ValueError(f'Portable executable checksum differs: {arch}')
        with exe.open('rb') as stream:
            if stream.read(2) != b'MZ':
                raise ValueError('Not a Windows executable')
            stream.seek(0x3C)
            stream.seek(struct.unpack('<I', stream.read(4))[0])
            if stream.read(4) != b'PE\0\0' or struct.unpack('<H', stream.read(2))[0] != machine:
                raise ValueError(f'Wrong executable architecture: {arch}')
        for name in ['node.exe', 'LICENSE', 'README.md']:
            files[f'runtime/win-{arch}/{name}'] = runtime / f'win-{arch}' / name
    for name in ['PROVENANCE.json', 'SHASUMS256.txt']:
        files[f'runtime/{name}'] = runtime / name
    for name in ['README.md', 'AGENTS.md', 'PRODUCT.md', 'package.json', 'Inditas.cmd']:
        files[name] = ROOT / name
    for folder in ['server', 'src', 'data', 'demo', 'docs', 'scripts']:
        for path in (ROOT / folder).rglob('*'):
            if path.is_symlink():
                raise ValueError(f'Symlink not allowed in release: {path}')
            if path.is_file() and '__pycache__' not in path.parts and path.suffix != '.pyc':
                files[path.relative_to(ROOT).as_posix()] = path
    for name in ['scripts/start-local.mjs', 'scripts/windows-start.cmd', 'demo/template.html']:
        if name not in files:
            raise ValueError(f'Required application file missing: {name}')
    if any('.local' in Path(name).parts or '.git' in Path(name).parts or
           Path(name).suffix in {'.sqlite', '.db', '.sqlite-wal', '.sqlite-shm'} for name in files):
        raise ValueError('Private state must not enter the distribution')
    output.parent.mkdir(parents=True, exist_ok=True)
    manifest = {}
    with ZipFile(output, 'w', compression=ZIP_DEFLATED, compresslevel=6) as bundle:
        for name, path in sorted(files.items()):
            data = path.read_bytes()
            if name.endswith('.cmd'):
                data = data.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
            manifest[name] = hashlib.sha256(data).hexdigest()
            bundle.writestr('Raktar/' + name, data)
        bundle.writestr('Raktar/OLVASS_EL.txt', (
            'RAKTARKEZELO - HELYI WINDOWS TESZT\r\n\r\n'
            '1. Bontsd ki a teljes ZIP-et (Osszes kibontasa).\r\n'
            '2. A kibontott Raktar mappaban dupla kattintas: Inditas.cmd\r\n'
            '3. Belepes: Teszt raktarfelelos. PIN: 1234.\r\n\r\n'
            'A bongeszo automatikusan megnyilik. Cim: http://127.0.0.1:4174\r\n'
            'Tartsd nyitva az inditoablakot. Leallitas: Enter vagy Ctrl+C.\r\n'
            'A probaadatok a .local mappaban maradnak meg; ezt orizd meg.\r\n'
            'A korabbi HTML-elonezet adatai nem kerulnek at automatikusan.\r\n'
            'Nincs elo r_keeper / StoreHouse kapcsolat.\r\n\r\n'
            'Reszletes utmutato: docs/windows-inditas.md\r\n'
        ))
        bundle.writestr('Raktar/CSOMAG-SHA256.json', json.dumps(manifest, indent=2) + '\n')
    print(f'{output}: {output.stat().st_size:,} bytes; {len(files)} verified source/runtime files')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime-dir', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    build(args.runtime_dir.resolve(), args.output.resolve())
