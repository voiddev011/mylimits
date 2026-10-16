"""Inspect the actual distributable archives, not only build-directory manifests."""
import json, zipfile
from pathlib import Path
version=json.loads(Path('package.json').read_text())['version']
for target in ['chrome','firefox']:
    file=Path(f'.output/mylimits-{version}-{target}.zip')
    with zipfile.ZipFile(file) as archive:
        names=archive.namelist()
        forbidden=[n for n in names if any(p in n for p in ['node_modules/','.git/','artifacts/','local-data/','bridge-token']) or n.endswith(('.env','.pem','.key'))]
        assert not forbidden,forbidden
        manifest=json.loads(archive.read('manifest.json'))
        assert manifest['version']==version
        assert not manifest.get('host_permissions')
        assert len(manifest['optional_host_permissions'])==6
        assert not manifest.get('content_scripts')
        assert all(n in names for n in ['popup.html','dashboard.html','background.js'])
        print(f'{target}: {file.stat().st_size} bytes, clean archive and optional grants verified')
