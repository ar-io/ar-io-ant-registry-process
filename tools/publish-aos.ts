import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const arweave = Arweave.init({
  host: 'arweave.net',
  port: 443,
  protocol: 'https',
});
async function main() {
  const bundledLua = fs.readFileSync(
    path.join(__dirname, '../dist/aos-bundled.lua'),
    'utf-8',
  );
  const wallet = fs.readFileSync(path.join(__dirname, 'key.json'), 'utf-8');
  const jwk = JSON.parse(wallet);
  const address = await arweave.wallets.jwkToAddress(jwk);

  console.log(`Publish AOS Lua with address ${address}`);

  const tx = await arweave.createTransaction({ data: bundledLua }, jwk);
  tx.addTag('App-Name', 'aos-LUA');
  tx.addTag('App-Version', '0.0.1');
  tx.addTag('Content-Type', 'text/x-lua');
  tx.addTag('Author', 'INSERT AUTHOR NAME');
  await arweave.transactions.sign(tx, jwk);
  await arweave.transactions.post(tx);

  console.log('Transaction ID:', tx.id);
}
main();
