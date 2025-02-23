import { AOProcess, createAoSigner, ArweaveSigner } from '@ar.io/sdk';
import { BUNDLED_AOS_LUA } from './constants.js';
import process from 'process';

const registryId = process.env.REGISTRY_ID;
const wallet = JSON.parse(process.env.WALLET);

const registry = new AOProcess({ processId: registryId });

const signer = createAoSigner(new ArweaveSigner(wallet));

const evolveResult = await registry.send({
  tags: [{ name: 'Action', value: 'Eval' }],
  data: BUNDLED_AOS_LUA,
  signer,
});
console.log(`Evolve result: ${JSON.stringify(evolveResult)}`);
