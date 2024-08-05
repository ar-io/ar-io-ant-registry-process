import { IO, AOProcess, ArweaveSigner, createAoSigner } from '@ar.io/sdk';
import Arweave from 'arweave';

const registryId = 'i_le_yKKPVstLTDSmkHRqf-wYphMnwB9OhleiTgMkWc';

async function main() {
  const arweave = Arweave.init();
  const jwk = await arweave.wallets.generate();
  const signer = createAoSigner(new ArweaveSigner(jwk));
  const ario = IO.init();
  const arnsRecords = await ario.getArNSRecords({
    limit: 50_000,
  });
  const antIds = arnsRecords.items.map((record) => record.processId);
  const processIds = new Set(antIds);

  const registry = new AOProcess({ processId: registryId });
  let count = 0;

  for (const antId of [...processIds]) {
    console.log(`Registering ${count++}/${processIds.size}...`);
    await registry
      .send({
        tags: [
          { name: 'Action', value: 'Register' },
          { name: 'Process-Id', value: antId },
        ],
        signer,
      })
      .catch((e) => console.error(e));
  }
}

main();
