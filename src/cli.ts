import dotenv from 'dotenv';
import { Command } from 'commander';
import Mangrove, { ethers } from '@mangrovedao/mangrove.js'
import { addLiquidity, addOneSidedLiquidity, marketBuyLimitPrice, marketInfo, marketSellLimitPrice, myPositions, removeLiquidity } from './controller';
dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.LOCAL_URL || 'http://127.0.0.1:8545');
const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

const program = new Command();
program
  .description('GroovySwap CLI - Swap, add liquidity, remove liquidity, and get market info, all from the command line on BLAST L2 soon')
  .version('0.0.1')
  .action(async () => {
    console.log('GroovySwap CLI');
    const balance = await provider.getBalance(signer.address);
    console.log('Balance:', ethers.utils.formatEther(balance), 'ETH');
  });

program
  .command('buy')
  .description('Buy tokens')
  .requiredOption('-b, --base <base>', 'Base token')
  .requiredOption('-q, --quote <quote>', 'Quote token')
  .requiredOption('-l, --limit-price <price>', 'Limit price')
  .requiredOption('-a, --amount <amount>', 'Amount')
  .action(async (options) => {
    console.log('Buying tokens...');
    console.log('Base:', options.base);
    console.log('Quote:', options.quote);
    console.log('Limit price:', options.limitPrice);
    console.log('Amount:', options.amount);

    const mgv = await Mangrove.connect({ signer: signer });
    const result = await marketBuyLimitPrice(mgv, options.base, options.quote, options.limitPrice, options.amount);
    console.log("Market Buy Result: ", result);
    console.log(`Bought ${result.summary.totalGot} ${options.base} for ${result.summary.totalGave} ${options.quote}`);
  });

program
  .command('sell')
  .description('Sell tokens')
  .requiredOption('-b, --base <base>', 'Base token')
  .requiredOption('-q, --quote <quote>', 'Quote token')
  .requiredOption('-l, --limit-price <price>', 'Limit price')
  .requiredOption('-a, --amount <amount>', 'Amount')
  .action(async (options) => {
    console.log('Selling tokens...');
    console.log('Base:', options.base);
    console.log('Quote:', options.quote);
    console.log('Limit price:', options.limitPrice);
    console.log('Amount:', options.amount);

    const mgv = await Mangrove.connect({ signer: signer });
    const result = await marketSellLimitPrice(mgv, options.base, options.quote, options.limitPrice, options.amount);

    console.log("Market Sell Result: ", result);
    console.log(`Sold ${result.summary.totalGave} ${options.base} for ${result.summary.totalGot} ${options.quote}`);

  });


program
  .command('info')
  .description('Get market info')
  .requiredOption('-b, --base <base>', 'Base token')
  .requiredOption('-q, --quote <quote>', 'Quote token')
  .action(async (options) => {
    console.log('Getting market info...');
    const mgv = await Mangrove.connect({ signer: signer });
    const result = await marketInfo(mgv, options.base, options.quote);
    console.log("Market Info: ", result);
  });


program
  .command('add-liquidity')
  .description('Add liquidity to a pool')
  .requiredOption('-b, --base <base>', 'Base token')
  .requiredOption('-q, --quote <quote>', 'Quote token')
  .requiredOption('-a, --amount <amount>', 'Amount')
  .option('-s, --slippage <slippage>', 'Slippage tolerance', '0.05')
  .option('-o, --one-side', 'Add liquidity to only one side of the pool, takes ask or bid')
  .action(async (options) => {
    console.log('Adding liquidity...');
    console.log('Base:', options.base);
    console.log('Quote:', options.quote);
    console.log('Amount:', options.amount);
    console.log('Slippage:', options.slippage);

    const mgv = await Mangrove.connect({ signer: signer });
    if (options.oneSide) {
      const result = await addOneSidedLiquidity(mgv, options.base, options.quote, options.amount, options.oneSide, Number(options.slippage || 0.05));
      console.log("Add One Sided Liquidity Result: ", result);
    } else {
      const result = await addLiquidity(mgv, options.base, options.quote, options.amount, Number(options.slippage || 0.05));
      console.log("Add Liquidity Result: ", result);
    }
  });


program
  .command('remove-liquidity')
  .description('Remove liquidity from a pool')
  .requiredOption('-b, --base <base>', 'Base token')
  .requiredOption('-q, --quote <quote>', 'Quote token')
  .action(async (options) => {
    console.log('Removing liquidity...');
    console.log('Base:', options.base);
    console.log('Quote:', options.quote);

    const mgv = await Mangrove.connect({ signer: signer });
    await removeLiquidity(mgv, options.base, options.quote);
  });

program
  .command('positions')
  .description('Get positions for the signer')
  .requiredOption('-b, --base <base>', 'Base token')
  .requiredOption('-q, --quote <quote>', 'Quote token')
  .action(async (options) => {
    console.log('Getting positions...');
    const mgv = await Mangrove.connect({ signer: signer });
    const positions = await myPositions(mgv, options.base, options.quote);
    console.log("Positions: ", positions);
  });


program.parse(process.argv);
