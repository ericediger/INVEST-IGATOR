#!/usr/bin/env python3
import urllib.request,json,subprocess,os,time,pathlib,tempfile
origin='http://127.0.0.1:5191'
def read():
    with urllib.request.urlopen(origin+'/api/workspace',timeout=5) as r: return json.load(r)
before=read()
assert [c['ticker'] for c in before['workspace']['companies']]==['ETN','VRT','NVT','APH','PWR','FIX','ANET']
assert not before['workspace']['snapshots'] and not before['workspace']['scenarios'] and not before['workspace']['decisions']
subprocess.run(['launchctl','kickstart','-k',f'gui/{os.getuid()}/com.investmentresearch.app'],check=True)
for attempt in range(30):
    try:
        after=read();break
    except Exception:time.sleep(.2)
else:raise AssertionError('Service did not restart')
assert before['workspace']==after['workspace'] and before['revision']==after['revision']
data=pathlib.Path('~/Library/Application Support/InvestmentResearch')
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
release=pathlib.Path('~/Desktop/_LOCAL APP DEVELOPMENT/FINANCIAL PLANNING/investment-research/current')
subprocess.run(['/usr/local/bin/node',str(release/'scripts/restore-database.js'),str(backup),str(parent/'restored')],check=True)
print('PASS: production seeded exactly seven companies with blank financial data')
print('PASS: launchd process restart preserved complete workspace and revision')
print('PASS: scheduled backup job ran and restored into a separate disposable workspace')
print('Backup:',backup)
print('Restore test:',parent/'restored')
