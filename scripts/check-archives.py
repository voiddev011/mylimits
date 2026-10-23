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
        assert all('providers/'+name in names for name in ['claude.svg','chatgpt.svg','gemini.png','grok.svg','perplexity.svg','cursor.svg'])
        bundled=''.join(archive.read(n).decode('utf-8') for n in names if n.endswith('.js'))
        assert not any('spike' in n.lower() for n in names), 'Release ZIP contains spike files'
        assert 'MYLIMITS_PRIVATE_SESSION_SPIKE' not in bundled and 'mylimits-spike-v1' not in bundled
        assert not any(p in manifest.get('permissions',[]) for p in ['cookies','declarativeNetRequestWithHostAccess','webRequest'])
        assert not any(p in manifest.get('optional_permissions',[]) for p in ['declarativeNetRequestWithHostAccess','webRequest','declarativeNetRequestFeedback'])
        assert 'Prompt template and local review' not in bundled
        assert 'Prepare a handoff' not in bundled
        assert not manifest.get('host_permissions')
        assert len(manifest['optional_host_permissions'])==6
        assert not manifest.get('content_scripts')
        assert all(n in names for n in ['popup.html','dashboard.html','background.js'])
        print(f'{target}: {file.stat().st_size} bytes, clean archive and optional grants verified')
