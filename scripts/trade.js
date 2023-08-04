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

const MIN_RESERVE_RATE = 100
const TOKEN_OFFSET = 0
const TOKEN_COUNT = 10

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

async function init() {
	console.log('DEXs are loading ...')

	const dexs = []

	for (const dex of config.dexs) {
		dex.factory = new web3.eth.Contract(UNISWAP_V2_FACTORY_ABI, dex.factoryAddress)
		dex.router = new web3.eth.Contract(UNISWAP_V2_ROUTER_ABI, dex.routerAddress)

		dexs.push(dex)
	}

	console.log("DEXs were loaded")

	console.log()

	console.log('Base tokens are loading ...')

	const baseTokens = []

	for (const baseToken of config.baseTokens) {
		baseToken.contract = new web3.eth.Contract(ERC20_ABI, baseToken.tokenAddress)
		baseToken.decimals = await baseToken.contract.methods.decimals().call()
		baseToken.minTradeAmount = BigInt(baseToken.minTradeAmount * 10 ** baseToken.decimals)
		baseToken.minProfitAmount = BigInt(baseToken.minProfitAmount * 10 ** baseToken.decimals)

		baseTokens.push(baseToken)
	}

	console.log('Base tokens were loaded')

	console.log()

	console.log('Candidate trades are loading ...')

	const candidateTrades = []

	for (const baseToken of baseTokens) {
		let pairs = await pairCollection.find(
			{ $or: [{ token0: baseToken.tokenAddress }, { token1: baseToken.tokenAddress }] }
		).sort({ index: 1 }).skip(TOKEN_OFFSET)

		if (TOKEN_COUNT > 0) {
			pairs = await pairs.limit(TOKEN_COUNT)
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

						if (!(await checkValidDex(dex1, baseToken, targetToken))) {
							continue
						}

						if (!(await checkValidDex(dex2, baseToken, targetToken))) {
							continue
						}

						candidateTrades.push({ baseToken, targetToken, dex1, dex2 })

						console.log(`${baseToken.symbol} => ${dex1.name} => ${targetToken.symbol} => ${dex2.name} => ${baseToken.symbol}`)
					}
				}
			} catch (error) {
				console.error(error)
			}
		}
	}

	console.log('Candidate trades are loaded')

	return candidateTrades
}

async function main() {
	console.log('********** Arbitrage Bot **********')

	console.log()

	console.log('The bot is initing ...\n')

	const candidateTrades = await init()

	console.log('\nThe bot was inited')

	console.log()

	while (true) {
		for (const candidateTrade of candidateTrades) {
			try {
				while (true) {
					let baseTokenBalance = await candidateTrade.baseToken.contract.methods.balanceOf(config.botAddress).call()
					baseTokenBalance = BigInt(baseTokenBalance)

					let estimatedOutAmount = await bot.methods.estimateTrade(
						candidateTrade.dex1.routerAddress,
						candidateTrade.dex2.routerAddress,
						candidateTrade.baseToken.tokenAddress,
						candidateTrade.targetToken.tokenAddress,
						baseTokenBalance
					).call()
					estimatedOutAmount = BigInt(estimatedOutAmount)

					console.log(
						`Estimated out amount: `,
						`${baseTokenBalance / 10 ** candidateTrade.baseToken.decimals} ${candidateTrade.baseToken.symbol}`,
						` => `,
						`${estimatedOutAmount / 10 ** candidateTrade.baseToken.decimals} ${candidateTrade.baseToken.symbol}`,
					)

					if (estimatedOutAmount > baseTokenBalance + candidateTrade.baseToken.minProfitAmount) {
						let tradedOutAmount = await bot.methods.trade(
							candidateTrade.dex1.routerAddress,
							candidateTrade.dex2.routerAddress,
							candidateTrade.baseToken.tokenAddress,
							candidateTrade.targetToken.tokenAddress,
							baseTokenBalance,
						).call({ from: account })
						tradedOutAmount = BigInt(tradedOutAmount)

						console.log(
							`Traded out amount: `,
							`${baseTokenBalance / 10 ** candidateTrade.baseToken.decimals} ${candidateTrade.baseToken.symbol}`,
							` => `,
							`${tradedOutAmount / 10 ** candidateTrade.baseToken.decimals} ${candidateTrade.baseToken.symbol}`,
						)
					} else {
						break
					}
				}
			} catch (error) {
				console.error(error)
			}
		}

		break
	}
}

async function test() {
	const tradeOutAmount = await bot.methods.trade(
		'0x10ED43C718714eb63d5aA57B78B54704E256024E',
		'0x3a6d8cA21D1CF76F653A67577FA0D27453350dD8',
		'0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
		'0x8076C74C5e3F5852037F31Ff0093Eeb8c8ADd8D3',
		Number(0.1 * 10 ** 18),
	).call({ from: account })

	console.log(tradeOutAmount)
}

main()

// test()
