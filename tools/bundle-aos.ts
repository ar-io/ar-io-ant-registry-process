import * as fs from 'fs';
import * as path from 'path';
import { bundle } from './lua-bundler.ts';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
async function main() {
  console.log('Bundling Lua...');
  const pathToLua = path.join(__dirname, '../src/aos.lua');
  console.log('Path to Lua:', pathToLua);
  const bundledLua = bundle(path.join(__dirname, '../src/aos.lua'));

  if (!fs.existsSync(path.join(__dirname, '../dist'))) {
    fs.mkdirSync(path.join(__dirname, '../dist'));
  }

  fs.writeFileSync(path.join(__dirname, '../dist/aos-bundled.lua'), bundledLua);
  console.log('Doth Lua hath been bundled!');
}

main();
