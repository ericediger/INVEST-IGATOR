"""Install a new immutable local release and preserve the database before switching."""
import json, os, pathlib, shutil, subprocess, urllib.request, time, plistlib, sys
source = pathlib.Path(__file__).resolve().parents[1]
base = pathlib.Path.home() / 'Desktop/_LOCAL APP DEVELOPMENT/FINANCIAL PLANNING/investment-research'
version = json.loads((source/'package.json').read_text())['version']
release = base/'releases'/version
current = base/'current'
config = plistlib.loads((pathlib.Path.home()/'Library/LaunchAgents/com.investmentresearch.app.plist').read_bytes())
data = pathlib.Path(config['EnvironmentVariables']['RESEARCH_DATA_DIR'])
node = config['ProgramArguments'][0]
service = f'gui/{os.getuid()}/com.investmentresearch.app'

def request(path, body=None):
    root='http://127.0.0.1:5191'
    headers={'Origin':root,'Content-Type':'application/json','X-Research-Request':'1'}
    req=urllib.request.Request(root+path,data=json.dumps(body).encode() if body is not None else None,headers=headers)
    with urllib.request.urlopen(req,timeout=20) as res:return json.load(res)

if release.exists():
    if sys.argv[1:]!=['--activate-existing']:raise SystemExit('Release already exists. Refusing to overwrite it.')
    # A failed activation leaves the verified immutable release in place. Compare runtime files before retrying.
    for name in ['server','public','node_modules','package.json','package-lock.json']:
        src=source/name; dst=release/name
        files=[src] if src.is_file() else [p for p in src.rglob('*') if p.is_file() and p.name!='.DS_Store']
        targets=[dst] if dst.is_file() else [p for p in dst.rglob('*') if p.is_file() and p.name!='.DS_Store']
        if {str(p.relative_to(source)) for p in files}!={str(p.relative_to(release)) for p in targets}:raise SystemExit('Existing release runtime file inventory differs.')
        for path in files:
            if path.read_bytes()!=(release/path.relative_to(source)).read_bytes():raise SystemExit('Existing release runtime differs from verified source.')

if not current.is_symlink():raise SystemExit('Expected installed current symlink.')
previous=current.resolve()
before=request('/api/workspace')
if any(r['status'] in ('queued','running') for r in request('/api/research/runs')['runs']):raise SystemExit('Research is running. Wait for completion before upgrading.')
backup=request('/api/backup',{})['backup']
if not release.exists():shutil.copytree(source,release,ignore=shutil.ignore_patterns('.git','runtime','.env','*.sqlite','*.sqlite-wal','*.sqlite-shm','*.db','.DS_Store','__pycache__'))
# The locked, already installed dependencies are copied with the verified source. No runtime secrets are in the release.
launcher=base/'Connect AI.command'
launcher_text='#!/bin/zsh\nset -eu\n'+ 'cd '+"'"+str(base).replace("'","'\\''")+"/current'\n" + "'"+node.replace("'","'\\''")+"' scripts/configure-ai.js\n"
if launcher.exists():
    if launcher.read_text()!=launcher_text:raise SystemExit('Existing key setup launcher differs. Inspect before replacing.')
else:
    launcher.write_text(launcher_text)
    launcher.chmod(0o700)
next_link=base/'current.next'
if next_link.exists() or next_link.is_symlink():raise SystemExit('Temporary release symlink already exists.')
next_link.symlink_to(release);next_link.replace(current)
try:
    subprocess.run(['launchctl','kickstart','-k',service],check=True)
    for attempt in range(40):
        try:
            after=request('/api/workspace')
            if after.get('version')==version:break
        except Exception:pass
        time.sleep(.25)
    else:raise RuntimeError('New release did not become healthy.')
    if after['workspace']!=before['workspace'] or after['revision']!=before['revision']:raise RuntimeError('Workspace differs after upgrade; investigate before proceeding.')
    ai=request('/api/research/status')
    postbackup=request('/api/backup',{})['backup']
    print(json.dumps({'version':version,'previousRelease':str(previous),'workspacePreserved':True,'aiKeyPresent':ai['configured'],'preUpgradeBackup':backup,'postUpgradeBackup':postbackup,'keySetup':str(launcher)}))
except Exception:
    rollback=base/'current.rollback';rollback.symlink_to(previous);rollback.replace(current)
    subprocess.run(['launchctl','kickstart','-k',service],check=True)
    raise
