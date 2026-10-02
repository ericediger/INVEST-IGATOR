#!/usr/bin/env python3
"""Deploy 1.0.1 for the owner's explicitly approved trusted home LAN; preserve data."""
from pathlib import Path
import os,shutil,plistlib,subprocess,json,urllib.request,time,socket,hashlib
src=Path(__file__).resolve().parent.parent
base=src.parent  # <app folder>/source -> <app folder>
release=base/'releases/1.0.1'
plist=Path('~/Library/LaunchAgents/com.investmentresearch.app.plist')
label=f'gui/{os.getuid()}/com.investmentresearch.app'
old_target=(base/'current').resolve()
old_config=plist.read_bytes()
if release.exists():raise SystemExit('Release 1.0.1 already exists; inspect it before retrying.')
if json.loads((src/'package.json').read_text())['version']!='1.0.1':raise SystemExit('Unexpected source version')
with socket.socket() as check:check.bind(('172.20.30.179',5191))
def read(url):
 with urllib.request.urlopen(url,timeout=5) as response:return json.load(response)
local='http://127.0.0.1:5191'
before=read(local+'/api/workspace')
req=urllib.request.Request(local+'/api/backup',data=b'{}',headers={'Origin':local,'Content-Type':'application/json','X-Research-Request':'1'},method='POST')
with urllib.request.urlopen(req,timeout=30) as response:backup=json.load(response)['backup']
os.umask(0o077)
release.mkdir(parents=True)
for name in ['server','public','scripts','docs','tests','node_modules']:shutil.copytree(src/name,release/name)
for name in ['package.json','package-lock.json','.gitignore','README.md','TEST-RESULTS.md']:shutil.copy2(src/name,release/name)
configs=base/'service-config-backups';configs.mkdir(exist_ok=True)
with (configs/'com.investmentresearch.app.before-1.0.1.plist').open('xb') as f:f.write(old_config)
config=plistlib.loads(old_config)
config['EnvironmentVariables'].update(RESEARCH_LAN_ADDRESS='172.20.30.179',RESEARCH_TRUSTED_SUBNET='172.20.30.0/24')
pending=plist.with_suffix('.plist.pending')
with pending.open('wb') as f:plistlib.dump(config,f)
subprocess.run(['plutil','-lint',str(pending)],check=True)
next_link=base/'current.next-1.0.1';next_link.symlink_to(release,target_is_directory=True)
subprocess.run(['launchctl','bootout',label],check=True)
try:
 os.replace(next_link,base/'current');os.replace(pending,plist)
 subprocess.run(['launchctl','bootstrap',f'gui/{os.getuid()}',str(plist)],check=True)
 for attempt in range(40):
  try:
   lan=read('http://<lan-address>:5191/api/workspace');loop=read(local+'/api/workspace')
   if lan['version']=='1.0.1' and loop['version']=='1.0.1':break
  except Exception:pass
  time.sleep(.25)
 else:raise RuntimeError('Updated service did not become healthy')
 assert lan['access']=='Trusted home network'
 assert lan['workspace']==loop['workspace']
 assert lan['workspace']==before['workspace'],'Workspace changed during deployment; inspect concurrent activity'
 with urllib.request.urlopen('http://<lan-address>:5191/',timeout=5) as response:assert response.status==200
 print('PASS: local and LAN endpoints respond with release 1.0.1')
 print('PASS: complete saved workspace unchanged through update')
 print('PASS: LAN page and data API both respond successfully')
 print('Pre-update backup:',backup)
 print('Open: http://<lan-address>:5191/')
except Exception:
 subprocess.run(['launchctl','bootout',label],check=False)
 rollback=base/'current.rollback';rollback.symlink_to(old_target,target_is_directory=True);os.replace(rollback,base/'current')
 plist.write_bytes(old_config)
 subprocess.run(['launchctl','bootstrap',f'gui/{os.getuid()}',str(plist)],check=True)
 raise
