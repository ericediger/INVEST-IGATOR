#!/usr/bin/env python3
"""Check an installed service: a launchd restart preserves the workspace, the backup job produces a backup,
and that backup restores into a disposable folder. The data folder, port, node binary and active release are
read from the app's LaunchAgent, so this works for whichever user installed with scripts/install-local.py."""
import urllib.request,json,subprocess,os,time,pathlib,tempfile,plistlib
agent=plistlib.loads((pathlib.Path.home()/'Library/LaunchAgents/com.investmentresearch.app.plist').read_bytes())
env=agent['EnvironmentVariables']
origin=f"http://127.0.0.1:{env.get('PORT','5191')}"
data=pathlib.Path(env['RESEARCH_DATA_DIR'])
node=agent['ProgramArguments'][0]
release=pathlib.Path(agent['WorkingDirectory'])  # <app folder>/current
def read():
    with urllib.request.urlopen(origin+'/api/workspace',timeout=5) as r: return json.load(r)
before=read()
subprocess.run(['launchctl','kickstart','-k',f'gui/{os.getuid()}/com.investmentresearch.app'],check=True)
for attempt in range(30):
    try:
        after=read();break
    except Exception:time.sleep(.2)
else:raise AssertionError('Service did not restart')
assert before['workspace']==after['workspace'] and before['revision']==after['revision']
backups=data/'backups'
previous=set(backups.glob('backup-*.sqlite'))
subprocess.run(['launchctl','kickstart',f'gui/{os.getuid()}/com.investmentresearch.backup'],check=True)
for attempt in range(40):
    new=set(backups.glob('backup-*.sqlite'))-previous
    if new:break
    time.sleep(.2)
else:raise AssertionError('Scheduled backup job did not produce a backup')
backup=next(iter(new))
parent=pathlib.Path(tempfile.mkdtemp(prefix='investment-research-service-restore-'))
subprocess.run([node,str(release/'scripts/restore-database.js'),str(backup),str(parent/'restored')],check=True)
print('PASS: launchd process restart preserved complete workspace and revision')
print('PASS: scheduled backup job ran and restored into a separate disposable workspace')
print('Backup:',backup)
print('Restore test:',parent/'restored')
