#!/usr/bin/env python3
"""Turn trusted home-LAN access on or off for the installed service.

    python3 scripts/enable-trusted-lan.py <private-ipv4-address> <subnet-cidr>    e.g. 192.168.1.20 192.168.1.0/24
    python3 scripts/enable-trusted-lan.py off

Edits the app LaunchAgent's environment (RESEARCH_LAN_ADDRESS and RESEARCH_TRUSTED_SUBNET), keeps a copy of the
previous configuration under service-config-backups/, restarts the app and verifies that every address serves the
same, unchanged workspace. Restores the previous configuration if the restarted service is not healthy.
There is still no login: every device on the subnet can read and change the workspace, so use this only on a
network you trust completely.
"""
from pathlib import Path
import os,sys,plistlib,subprocess,json,urllib.request,time,socket,ipaddress,datetime
args=sys.argv[1:]
if not args or args[0] in ('-h','--help') or (args[0]=='off' and len(args)!=1) or (args[0]!='off' and len(args)!=2):
    print(__doc__.strip());sys.exit(2)
plist=Path.home()/'Library/LaunchAgents/com.investmentresearch.app.plist'
if not plist.exists():raise SystemExit(f'No installed service: {plist} not found. Run scripts/install-local.py first.')
label=f'gui/{os.getuid()}/com.investmentresearch.app'
old_config=plist.read_bytes()
config=plistlib.loads(old_config)
env=config['EnvironmentVariables']
port=env.get('PORT','5191')
local=f'http://127.0.0.1:{port}'
base=Path(config['WorkingDirectory']).parent  # WorkingDirectory is <app folder>/current
if args[0]=='off':
    address=None
    env.pop('RESEARCH_LAN_ADDRESS',None);env.pop('RESEARCH_TRUSTED_SUBNET',None)
else:
    address,subnet=args
    ip=ipaddress.ip_address(address);net=ipaddress.ip_network(subnet,strict=True)
    if ip.version!=4 or not ip.is_private:raise SystemExit('The LAN address must be a private IPv4 address')
    if ip not in net:raise SystemExit('The LAN address must belong to the trusted subnet')
    with socket.socket() as check:check.bind((address,int(port)))  # the address must exist on this machine with the port free
    env.update(RESEARCH_LAN_ADDRESS=address,RESEARCH_TRUSTED_SUBNET=str(net))
def read(url):
    with urllib.request.urlopen(url,timeout=5) as response:return json.load(response)
before=read(local+'/api/workspace')
configs=base/'service-config-backups';configs.mkdir(exist_ok=True)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
with (configs/f'com.investmentresearch.app.before-{stamp}.plist').open('xb') as f:f.write(old_config)
pending=plist.with_suffix('.plist.pending')
with pending.open('wb') as f:plistlib.dump(config,f)
subprocess.run(['plutil','-lint',str(pending)],check=True)
expected=[local]+([f'http://{address}:{port}'] if address else [])
subprocess.run(['launchctl','bootout',label],check=False)
try:
    os.replace(pending,plist)
    subprocess.run(['launchctl','bootstrap',f'gui/{os.getuid()}',str(plist)],check=True)
    for attempt in range(40):
        try:
            results=[read(url+'/api/workspace') for url in expected];break
        except Exception:pass
        time.sleep(.25)
    else:raise RuntimeError('Updated service did not become healthy')
    for result in results:
        assert result['workspace']==before['workspace'],'Workspace changed during the restart; inspect concurrent activity'
        assert result['access']==('Trusted home network' if address else 'Server Mac only'),result['access']
    for url in expected:
        with urllib.request.urlopen(url+'/',timeout=5) as response:assert response.status==200
    print('PASS: service restarted with the new access configuration; the saved workspace is unchanged')
    for url in expected:print('Open:',url+'/')
    if address:print('No login: every device on',str(net),'can read and change this workspace.')
except Exception:
    subprocess.run(['launchctl','bootout',label],check=False)
    plist.write_bytes(old_config)
    subprocess.run(['launchctl','bootstrap',f'gui/{os.getuid()}',str(plist)],check=True)
    raise
