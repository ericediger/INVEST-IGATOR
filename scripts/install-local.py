#!/usr/bin/env python3
"""First install on macOS: copy a tested release next to this source checkout and create two launchd jobs.

Never replaces an existing release or service. Paths come from this script's location and the installing user's
home folder; RESEARCH_DATA_DIR and PORT in the environment override the defaults. The service is loopback-only;
scripts/enable-trusted-lan.py turns on trusted home-LAN access afterwards."""
import os, pathlib, shutil, plistlib, subprocess, json
src=pathlib.Path(__file__).resolve().parent.parent
base=src.parent  # <app folder>/source -> <app folder>
version=json.loads((src/'package.json').read_text())['version']
release=base/'releases'/version
if release.exists(): raise SystemExit('Release already exists; choose a new version. Nothing replaced.')
node=shutil.which('node')
if not node: raise SystemExit('Node is required')
home=pathlib.Path.home()
data=pathlib.Path(os.environ.get('RESEARCH_DATA_DIR') or home/'Library/Application Support/InvestmentResearch').expanduser().resolve()
agents=home/'Library/LaunchAgents'
port=int(os.environ.get('PORT') or 5191)
labels=['com.investmentresearch.app','com.investmentresearch.backup']
if any((agents/(label+'.plist')).exists() for label in labels): raise SystemExit('Existing service configuration found; review before changing it.')
# Ensure the chosen port is unoccupied; preserve all existing services.
import socket
with socket.socket() as check: check.bind(('127.0.0.1',port))
os.umask(0o077)
release.mkdir(parents=True)
for name in ['server','public','scripts','docs','tests','node_modules']:
    shutil.copytree(src/name,release/name)
for name in ['package.json','package-lock.json','.gitignore']:
    shutil.copy2(src/name,release/name)
for name in ['README.md','TEST-RESULTS.md']:
    if (src/name).exists(): shutil.copy2(src/name,release/name)
data.mkdir(parents=True,exist_ok=True)
(data/'logs').mkdir(exist_ok=True)
agents.mkdir(parents=True,exist_ok=True)
base.joinpath('current').symlink_to(release,target_is_directory=True)
env={'RESEARCH_DATA_DIR':str(data),'PORT':str(port),'NODE_ENV':'production','PATH':str(pathlib.Path(node).parent)+':/usr/bin:/bin'}
common={'WorkingDirectory':str(base/'current'),'EnvironmentVariables':env,'ProcessType':'Background','Umask':63}
app={**common,'Label':labels[0],'ProgramArguments':[node,str(base/'current/server/index.js')],'RunAtLoad':True,'KeepAlive':True,'ThrottleInterval':10,'StandardOutPath':str(data/'logs/app.log'),'StandardErrorPath':str(data/'logs/app-error.log')}
backup={**common,'Label':labels[1],'ProgramArguments':[node,str(base/'current/scripts/backup.js')],'StartCalendarInterval':{'Hour':2,'Minute':30},'StandardOutPath':str(data/'logs/backup.log'),'StandardErrorPath':str(data/'logs/backup-error.log')}
for config in [app,backup]:
    path=agents/(config['Label']+'.plist')
    with path.open('xb') as f: plistlib.dump(config,f)
    subprocess.run(['plutil','-lint',str(path)],check=True)
    subprocess.run(['launchctl','bootstrap',f'gui/{os.getuid()}',str(path)],check=True)
print('Installed release',release)
print('Data:',data)
print(f'URL: http://127.0.0.1:{port}')
