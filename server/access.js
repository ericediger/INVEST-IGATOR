import {isIP} from 'node:net';

const loopback = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const ipNumber = address => address.split('.').reduce((n, part) => (n * 256 + Number(part)) >>> 0, 0);
const privateIP = address => {
  if(isIP(address)!==4) return false;
  const [a,b] = address.split('.').map(Number);
  return a===10 || (a===172 && b>=16 && b<=31) || (a===192 && b===168);
};

export function accessPolicy({origin='http://127.0.0.1:5191', lanAddress=null, trustedSubnet=null}={}) {
  const local = new URL(origin);
  if(local.protocol!=='http:' || local.hostname!=='127.0.0.1' || local.origin!==origin) throw new Error('Use an exact loopback HTTP origin');
  const origins = new Map([[local.host, origin]]);
  let network=0, mask=0;
  if(lanAddress || trustedSubnet) {
    if(!privateIP(lanAddress) || !trustedSubnet) throw new Error('LAN access requires a private IPv4 address and explicit trusted subnet');
    const [base,bits,...extra] = trustedSubnet.split('/');
    if(extra.length || !privateIP(base) || !/^\d+$/.test(bits) || Number(bits)<24 || Number(bits)>30) throw new Error('Trusted LAN must be a private /24 or smaller subnet (through /30)');
    mask=(0xffffffff << (32-Number(bits))) >>> 0;
    network=(ipNumber(base)&mask) >>> 0;
    if(ipNumber(base)!==network || ((ipNumber(lanAddress)&mask)>>>0)!==network) throw new Error('LAN address must belong to the canonical trusted subnet');
    const lanOrigin=`http://${lanAddress}${local.port?':'+local.port:''}`;
    origins.set(new URL(lanOrigin).host,lanOrigin);
  }
  return {
    origins,
    addresses:lanAddress?['127.0.0.1',lanAddress]:['127.0.0.1'],
    label:lanAddress?'Trusted home network':'Server Mac only',
    description:lanAddress?`Access is available to devices on the trusted ${trustedSubnet} home network without a login. Research and backups stay on the server Mac.`:'Access is available only on the server Mac through loopback. Research and backups stay on the server Mac.',
    allows(address,host) {
      if(!origins.has(host)) return false;
      if(loopback.has(address)) return true;
      if(!lanAddress) return false;
      const normalized=address?.startsWith('::ffff:')?address.slice(7):address;
      return isIP(normalized||'')===4 && ((ipNumber(normalized)&mask)>>>0)===network;
    }
  };
}
