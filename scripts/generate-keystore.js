import forge from 'node-forge';
import fs from 'fs';
import path from 'path';

console.log('Generating 2048-bit RSA key pair...');
const keys = forge.pki.rsa.generateKeyPair(2048);

const cert = forge.pki.createCertificate();
cert.publicKey = keys.publicKey;
cert.serialNumber = '01' + Date.now().toString(16);
cert.validity.notBefore = new Date();
cert.validity.notAfter = new Date();
cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 30);

const attrs = [
  { name: 'commonName', value: 'Heartbeat Love Counter' },
  { name: 'countryName', value: 'US' },
  { name: 'organizationName', value: 'Heartbeat Apps' },
  { name: 'organizationalUnitName', value: 'Mobile' }
];

cert.setSubject(attrs);
cert.setIssuer(attrs);
cert.sign(keys.privateKey, forge.md.sha256.create());

console.log('Packaging into PKCS#12 keystore...');
const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
  keys.privateKey,
  [cert],
  'loveCounterReleasePass2026',
  {
    algorithm: '3des',
    friendlyName: 'loveCounterKey',
    generateLocalKeyId: true
  }
);

const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
const targetPath = path.resolve('android/app/release.keystore');

fs.writeFileSync(targetPath, Buffer.from(p12Der, 'binary'));
console.log('Release keystore created successfully at:', targetPath);
