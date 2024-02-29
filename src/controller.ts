import dotenv from 'dotenv';
import { Mangrove, Market, ethers } from "@mangrovedao/mangrove.js";
// import { ethers } from "ethers";

dotenv.config();

const provider = new ethers.providers.JsonRpcProvider(process.env.LOCAL_URL || "http://127.0.0.1:8545");
console.log("provider connected!");
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!);
const walletWithProvider = wallet.connect(provider);
console.log("wallet connected!");


export const marketBuyLimitPrice = async (mgv: Mangrove, base: string, quote: string, limitPrice: number, volume: number) => {

  const market = await getMarket(mgv, base, quote);
  if (!market) {
    throw new Error("Market not found");
  }

  // make sure the market is active
  if (!await market.isActive()) {
    throw new Error("Market is not active");
  }

  const buys = await market.buy({
    volume: volume,
    limitPrice: limitPrice,
    fillOrKill: false,
  });

  const result = await buys.result;

  return result;
};

export const marketSellLimitPrice = async (mgv: Mangrove, base: string, quote: string, limitPrice: number, volume: number) => {

  const market = await getMarket(mgv, base, quote);
  if (!market) {
    throw new Error("Market not found");
  }

  // make sure the market is active
  if (!await market.isActive()) {
    throw new Error("Market is not active");
  }

  const sells = await market.sell({
    volume: volume,
    limitPrice: limitPrice,
    fillOrKill: false,
  });

  const result = await sells.result;

  return result;
};

export const addLiquidity = async (mgv: Mangrove, base: string, quote: string, amount: number, overUnder?: number) => {
  const market = await getMarket(mgv, base, quote);
  if (!market) {
    throw new Error("Market not found");
  }

  // make sure the market is active
  if (!await market.isActive()) {
    throw new Error("Market is not active");
  }


  const directLP = await mgv.liquidityProvider(market);
  const provisionAsk = await directLP.computeAskProvision();
  const provisionBid = await directLP.computeBidProvision();

  const currentBids = Array.from(await market.getSemibook("bids"));
  const currentAsks = Array.from(await market.getSemibook("asks"));

  // make sure the user approved the market to spend their tokens
  await market.base.approve(mgv.address, { amount: amount });
  await market.quote.approve(mgv.address, { amount: amount });

  const spread = await market.spread();
  const slippage = overUnder || 0;


  // calculate the gives amount based on the spread
  const askGives = amount * (currentAsks[0].price * (1 - slippage));
  const bidGives = amount * (currentBids[0].price * (1 + slippage));

  // craft the ask and bid
  const askTx = await directLP.newAsk({
    wants: amount,
    gives: askGives,
    fund: provisionAsk
  });

  const bidTx = await directLP.newBid({
    wants: amount,
    gives: bidGives,
    fund: provisionBid
  });

  console.log("bidTx: ", bidTx);
  console.log("askTx: ", askTx);

  return {
    ask: askTx,
    bid: bidTx,
  };
};

export const addOneSidedLiquidity = async (mgv: Mangrove, base: string, quote: string, amount: number, side: "ask" | "bid", overUnder?: number) => {
  const market = await getMarket(mgv, base, quote);
  if (!market) {
    throw new Error("Market not found");
  }

  // make sure the market is active
  if (!await market.isActive()) {
    throw new Error("Market is not active");
  }

  const directLP = await mgv.liquidityProvider(market);
  const provisionAsk = await directLP.computeAskProvision();
  const provisionBid = await directLP.computeBidProvision();

  const currentBids = Array.from(await market.getSemibook("bids"));
  const currentAsks = Array.from(await market.getSemibook("asks"));

  // make sure the user approved the market to spend their tokens
  await market.base.approve(mgv.address, { amount: amount });
  await market.quote.approve(mgv.address, { amount: amount });

  const spread = await market.spread();
  const slippage = overUnder || 0;

  // calculate the gives amount based on the spread
  const askGives = amount * currentAsks[0].price * (1 - slippage)
  const bidGives = amount * currentBids[0].price * (1 + slippage)

  // craft the ask and bid
  if (side === "ask") {
    const askTx = await directLP.newAsk({
      wants: amount,
      gives: askGives,
      fund: provisionAsk
    });

    return {
      ask: askTx,
    };
  } else {
    const bidTx = await directLP.newBid({
      wants: amount,
      gives: bidGives,
      fund: provisionBid
    });

    return {
      bid: bidTx,
    };
  }
};

export const removeLiquidity = async (mgv: Mangrove, base: string, quote: string) => {
  const market = await getMarket(mgv, base, quote);
  if (!market) {
    throw new Error("Market not found");
  }

  // make sure the market is active
  if (!await market.isActive()) {
    throw new Error("Market is not active");
  }

  const directLP = await mgv.liquidityProvider(market);
  const userAsks = await directLP.asks();
  const userBids = await directLP.bids();

  console.log("userAsks: ", userAsks);
  console.log("userBids: ", userBids);

  // TODO bigint this
  const totalAsks = userAsks.reduce((acc, ask) => {
    return acc + ask.gives.toNumber();
  }, 0);
  const totalBids = userBids.reduce((acc, bid) => {
    return acc + bid.gives.toNumber();
  }, 0);
  const amount = Math.max(totalAsks, totalBids);

  // make sure the user approved the market to spend their tokens
  await market.base.approve(mgv.address, { amount: amount });
  await market.quote.approve(mgv.address, { amount: amount });

  // I can't do this because the nonces will fall out of sync
  // do we have multicall support?
  // const asksPromises = userAsks.map(async (ask) => {
  //   return directLP.retractAsk(ask.id);
  // });

  // const bidsPromises = userBids.map(async (bid) => {
  //   return directLP.retractBid(bid.id);
  // });

  // await Promise.all(asksPromises.concat(bidsPromises));
  const startingNonce = await mgv.signer.getTransactionCount() + 1;
  console.log("startingNonce: ", startingNonce);
  for (let i = 0; i < userAsks.length; i++) {
    console.log('ask: ', userAsks[i].id);
    await directLP.retractAsk(userAsks[i].id, true);
  }

  const postAsksNonce = await mgv.signer.getTransactionCount() + 1;
  console.log("postAsksNonce: ", postAsksNonce);

  for (let i = 0; i < userBids.length; i++) {
    console.log('bid: ', userBids[i].id);
    await directLP.retractBid(userBids[i].id, true);
  }

  console.log("liquidity removed! Rug pull successful!"); // lol

};


export const getOpenMarkets = async (mgv: Mangrove) => {
  const openMarkets = await mgv.openMarkets();

  const markets = openMarkets.map(async (market) => {
    return {
      base: market.base,
      quote: market.quote,
      market: await mgv.market({
        base: market.base,
        quote: market.quote,
        tickSpacing: market.tickSpacing,
      }),
    };
  });

  return markets;
}

export const getMarket = async (mgv: Mangrove, base: string, quote: string) => {
  const openMarkets = await mgv.openMarkets();
  const marketInfo = openMarkets.find((market) => {
    return market.base.symbol === base && market.quote.symbol === quote;
  });
  if (!marketInfo) {
    return null;
  }

  const market = await mgv.market({
    base,
    quote,
    tickSpacing: marketInfo?.tickSpacing || 1,
  });

  return market;
}

export const myPositions = async (mgv: Mangrove, base: string, quote: string) => {
  const market = await getMarket(mgv, base, quote);
  if (!market) {
    throw new Error("Market not found");
  }

  const baseBalance = await market.base.balanceOf(process.env.ADMIN_ADDRESS!);
  const quoteBalance = await market.quote.balanceOf(process.env.ADMIN_ADDRESS!);

  const directLP = await mgv.liquidityProvider(market);
  const userAsks = await directLP.asks();
  const userBids = await directLP.bids();

  return {
    asks: userAsks,
    bids: userBids,
    baseBalance,
    quoteBalance,
  };
};

export const marketInfo = async (mgv: Mangrove, base: string, quote: string) => {
  const market = await getMarket(mgv, base, quote);
  if (!market) {
    throw new Error("Market not found");
  }

  const asks = Array.from(await market.getSemibook("asks"));
  const bids = Array.from(await market.getSemibook("bids"));

  console.log("asks: ");
  console.log(await market.consoleAsks());
  console.log("-----------------------------------")
  console.log("bids: ");
  console.log(await market.consoleBids());
  console.log("-----------------------------------")

  const firstBid = bids[0];
  const firstAsk = asks[0];

  const totalAsks = asks.reduce((acc, ask) => {
    return acc + ask.gives.toNumber();
  }, 0);

  const totalBids = bids.reduce((acc, bid) => {
    return acc + bid.gives.toNumber();
  }, 0);

  console.log("totalAsks: ", totalAsks);
  console.log("totalBids: ", totalBids);

  return {
    // asks,
    // bids,
    spread: await market.spread(),
    firstBid,
    firstAsk,
    totalAsks,
    totalBids,
  };
}


// provide liquidty to the market
// (async () => {
//   const mgv = await Mangrove.connect({ signer: walletWithProvider });
//   const txs = await addLiquidity(mgv, "USDC", "USDT", 100, 0.01);
//   console.log("txs: ", txs);
// })().catch(console.error);


// remove liquidity from the market
// (async () => {
//   const mgv = await Mangrove.connect({ signer: walletWithProvider });
//   await removeLiquidity(mgv, "USDC", "USDT");
//   console.log("liquidity removed!");
// })().catch(console.error);

// buy from the market
// (async () => {
//   const mgv = await Mangrove.connect({ signer: walletWithProvider });
//   const result = await marketBuyLimitPrice(mgv, "USDC", "USDT", 1.203, 10);
//   console.log("Market Buy Result: ", result);
//   console.log(`Bought ${result.summary.totalGot} USDC for ${result.summary.totalGave} USDT`);
// })().catch(console.error);

// sell to the market
// (async () => {
//   const mgv = await Mangrove.connect({ signer: walletWithProvider });
//   const result = await marketSellLimitPrice(mgv, "USDC", "USDT", 0.99, 2);
//   console.log("Market Sell Result: ", result);
//   console.log(`Sold ${result.summary.totalGave} USDC for ${result.summary.totalGot} USDT`);
// })().catch(console.error);

// market info
// (async () => {
//   const mgv = await Mangrove.connect({ signer: walletWithProvider });
//   const info = await marketInfo(mgv, "USDC", "USDT");
//   // console.log("Market Info: ", info);
// })().catch(console.error);

// my positions
// (async () => {
//   const mgv = await Mangrove.connect({ signer: walletWithProvider });
//   const positions = await myPositions(mgv, "USDC", "USDT");
//   console.log("My Positions: ", positions);
// })().catch(console.error);