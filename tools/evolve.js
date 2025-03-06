import { AOProcess, createAoSigner, ArweaveSigner } from '@ar.io/sdk';
import { BUNDLED_AOS_LUA } from './constants.js';
import { connect } from '@permaweb/aoconnect';
import process from 'process';

const registryId = process.env.REGISTRY_ID;
const wallet = JSON.parse(process.env.WALLET);

const vaotId = process.env.VAOT_ID;

const signer = createAoSigner(new ArweaveSigner(wallet));
const ao = connect({
  CU_URL: 'https://cu.ardrive.io',
});

const proposalResult = ao.message({
  process: vaotId,
  tags: [
    { name: 'Action', value: 'Propose' },
    { name: 'Proposal-Type', value: 'Eval' },
    { name: 'Vote', value: 'yay' },
    { name: 'Process-Id', value: registryId },
  ],
  data: BUNDLED_AOS_LUA,
  signer,
});
console.log(`Evolve result: ${JSON.stringify(proposalResult)}`);
