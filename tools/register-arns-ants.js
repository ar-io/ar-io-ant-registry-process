import { IO, AOProcess, ArweaveSigner, createAoSigner } from '@ar.io/sdk';
import Arweave from 'arweave';

const registryId = '6_b3wHAtM4WLUyrVJmfCPocRY3glayaEqZz8YqumcWQ';

async function main() {
  const arweave = Arweave.init();
  const jwk = await arweave.wallets.generate();
  const signer = createAoSigner(new ArweaveSigner(jwk));
  const ario = IO.init();
  const arnsRecords = await ario.getArNSRecords({
    limit: 50_000,
  });
  const antIds = arnsRecords.items.map((record) => record.processId);

  const registry = new AOProcess({ processId: registryId });
  let count = 0;

  for (const antId of antIds) {
    console.log(`Registering ${count++}/${antIds.length}...`);
    await registry.send({
      tags: [
        { name: 'Action', value: 'Register' },
        { name: 'Process-Id', value: antId },
      ],
      signer,
    });
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

main();
