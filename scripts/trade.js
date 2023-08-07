const {
	config,
	web3,
	pairCollection,
} = require('./global.js')

const ERC20_ABI = require('./abi/ERC20-ABI.json')

const UNISWAP_V2_FACTORY_ABI = require('./abi/UNISWAP-V2-FACTORY-ABI.json')
const UNISWAP_V2_ROUTER_ABI = require('./abi/UNISWAP-V2-ROUTER-ABI.json')
const UNISWAP_V2_PAIR_ABI = require('./abi/UNISWAP-V2-PAIR-ABI.json')

const BOT_ABI = require('./abi/BOT-ABI.json')

////////////////////////////////////////////////////////////////

const NULL_ADDRESS = '0x0000000000000000000000000000000000000000'

const MIN_RESERVE_RATE = 10
const PAIR_OFFSET = 0
const PAIR_COUNT = 0
const IS_TEST = false

const account = web3.eth.accounts.privateKeyToAccount(hre.network.config.accounts[0])
const bot = new web3.eth.Contract(BOT_ABI, config.botAddress)

////////////////////////////////////////////////////////////////

async function checkValidDex(dex, baseToken, targetToken) {
	try {
		const pairAddress = await dex.factory.methods.getPair(baseToken.tokenAddress, targetToken.tokenAddress).call()
		if (!pairAddress || pairAddress === NULL_ADDRESS) {
			return false
		}

		const pairContract = new web3.eth.Contract(UNISWAP_V2_PAIR_ABI, pairAddress)

		const token0 = await pairContract.methods.token0().call()
		const token1 = await pairContract.methods.token1().call()

		const reserves = await pairContract.methods.getReserves().call()
		let baseTokenReserveAmount = 0

		if (token0 === baseToken.tokenAddress) {
			baseTokenReserveAmount = BigInt(reserves._reserve0)
		} else if (token1 === baseToken.tokenAddress) {
			baseTokenReserveAmount = BigInt(reserves._reserve1)
		}

		if (baseTokenReserveAmount < BigInt(MIN_RESERVE_RATE) * baseToken.minTradeAmount) {
			return false
		}

		return true
	} catch (error) {
		console.error(error)
	}

	return false
}

async function main() {
	console.log('********** Arbitrage Bot **********')

	console.log()

	console.log('DEXs are loading ...')

	const dexs = []

	for (const dex of config.dexs) {
		dex.factory = new web3.eth.Contract(UNISWAP_V2_FACTORY_ABI, dex.factoryAddress)
		dex.router = new web3.eth.Contract(UNISWAP_V2_ROUTER_ABI, dex.routerAddress)

		dexs.push(dex)

		console.log(`${dex.name} was loaded`)
	}

	if (dexs.length < 2) {
		console.log('Valid DEX count is less than 2')
		return
	}

	console.log('All DEXs were loaded')

	console.log()

	console.log('Base tokens are loading ...')

	const baseTokens = []

	for (const baseToken of config.baseTokens) {
		baseToken.contract = new web3.eth.Contract(ERC20_ABI, baseToken.tokenAddress)
		baseToken.decimals = await baseToken.contract.methods.decimals().call()
		baseToken.minTradeAmount = BigInt(baseToken.minTradeAmount * 10 ** baseToken.decimals)
		baseToken.minProfitAmount = BigInt(baseToken.minProfitAmount * 10 ** baseToken.decimals)

		baseTokens.push(baseToken)

		console.log(`${baseToken.symbol} was loaded`)
	}

	if (!baseTokens.length) {
		console.log('There is no valid base token')
		return
	}

	console.log('All base tokens were loaded')

	console.log()

	console.log('Trade is starting ...')

	let totalProfitAmount = {}

	for (const baseToken of baseTokens) {
		totalProfitAmount[baseToken.symbol] = 0

		const baseTokenDecimal = 10 ** baseToken.decimals

		const query = { $and: [] }

		query.$and.push({ $or: [{ token0: baseToken.tokenAddress }, { token1: baseToken.tokenAddress }] })

		if (PAIR_OFFSET > 0) {
			query.$and.push({ index: { $gt: PAIR_OFFSET - 1 } })
		}

		if (PAIR_COUNT > 0) {
			query.$and.push({ index: { $lt: PAIR_OFFSET + PAIR_COUNT } })
		}

		let pairs = await pairCollection.find(
			
		).sort({ index: 1 }).skip(PAIR_OFFSET)

		if (PAIR_COUNT > 0) {
			pairs = await pairs.limit(PAIR_COUNT)
		}

		pairs = await pairs.toArray()

		for (const pair of pairs) {
			try {
				const targetToken = {}

				if (pair.token0 === baseToken.tokenAddress) {
					targetToken.tokenAddress = pair.token1
				} else if (pair.token1 === baseToken.tokenAddress) {
					targetToken.tokenAddress = pair.token0
				} else {
					continue
				}

				targetToken.contract = new web3.eth.Contract(ERC20_ABI, targetToken.tokenAddress)
				targetToken.decimals = await targetToken.contract.methods.decimals().call()
				targetToken.symbol = await targetToken.contract.methods.symbol().call()

				for (const dex1 of dexs) {
					for (const dex2 of dexs) {
						if (dex1 === dex2) {
							continue
						}

						console.log()

						console.log(`${pair.index}th pair: ${baseToken.symbol} => ${dex1.name} => ${targetToken.symbol} => ${dex2.name} => ${baseToken.symbol}`)

						let baseTokenBalance

						if (IS_TEST) {
							baseTokenBalance = baseToken.minTradeAmount
						} else {
							baseTokenBalance = await baseToken.contract.methods.balanceOf(config.botAddress).call()
							baseTokenBalance = BigInt(baseTokenBalance)
						}

						if (baseTokenBalance < baseToken.minTradeAmount) {
							console.log(`Bot's ${baseToken.symbol} balance is less than minimum trade amount`)
							continue
						}

						if (!(await checkValidDex(dex1, baseToken, targetToken))) {
							console.log(`${dex1.name} isn't valid to trade ${baseToken.symbol} and ${targetToken.symbol}`)
							continue
						}

						if (!(await checkValidDex(dex2, baseToken, targetToken))) {
							console.log(`${dex2.name} isn't valid to trade ${baseToken.symbol} and ${targetToken.symbol}`)
							continue
						}

						try {
							while (true) {
								let estimatedOutAmount = await bot.methods.estimateTrade(
									dex1.routerAddress,
									dex2.routerAddress,
									baseToken.tokenAddress,
									targetToken.tokenAddress,
									baseTokenBalance
								).call()
								estimatedOutAmount = BigInt(estimatedOutAmount)

								console.log(
									`Estimated out amount: `,
									`${Number(baseTokenBalance) / baseTokenDecimal} ${baseToken.symbol}`,
									` => `,
									`${Number(estimatedOutAmount) / baseTokenDecimal} ${baseToken.symbol}`,
								)

								if (targetToken.symbol === 'CEL') 
									console.log()

								if (!IS_TEST) {
									if (estimatedOutAmount > baseTokenBalance + baseToken.minProfitAmount) {
										let tradedOutAmount = await bot.methods.trade(
											dex1.routerAddress,
											dex2.routerAddress,
											baseToken.tokenAddress,
											targetToken.tokenAddress,
											baseTokenBalance,
										).call({ from: account })
										tradedOutAmount = BigInt(tradedOutAmount)
	
										console.log(
											`Traded out amount: `,
											`${Number(baseTokenBalance) / baseTokenDecimal} ${baseToken.symbol}`,
											` => `,
											`${Number(tradedOutAmount) / baseTokenDecimal} ${baseToken.symbol}`,
										)

										const profitAmount = Number(tradedOutAmount - baseTokenBalance) / baseTokenDecimal
	
										console.log(`Profit amount: ${profitAmount} ${baseToken.symbol}`)

										totalProfitAmount[baseToken.symbol] += profitAmount
									} else {
										console.log('This trade isn\'t profitable')
										break
									}
								} else {
									break
								}
							}
						} catch (error) {
							console.error(error)
						}
					}
				}
			} catch (error) {
				console.error(error)
			}
		}
			
	}

	console.log()

	console.log('Trade was finished')

	console.log()
	
	for (const baseToken of baseTokens) {
		console.log(`Total ${baseToken.symbol} profit amount: ${totalProfitAmount[baseToken.symbol]} ${baseToken.symbol}`)
	}

	process.exit(0)
}

main()
