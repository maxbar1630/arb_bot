const {
	config,
	web3,
	configCollection,
	pairCollection,
	synced_pair_count_field,
} = require('./global.js')

const UNISWAP_V2_FACTORY_ABI = require('./abi/UNISWAP-V2-FACTORY-ABI.json')
const UNISWAP_V2_PAIR_ABI = require('./abi/UNISWAP-V2-PAIR-ABI.json')

async function scanPair() {
	console.log('Scan is starting ...')

	const dbConfig = await configCollection.findOne()
	let synced_pair_count = -1

	if (dbConfig) {
		if (dbConfig[synced_pair_count_field]) {
			synced_pair_count = dbConfig[synced_pair_count_field]
		} else {
			await configCollection.updateOne({}, { $set: { [synced_pair_count_field]: synced_pair_count } })
		}
	} else {
		await configCollection.insertOne({ [synced_pair_count_field]: synced_pair_count })
	}

	const uniswapV2Factory = new web3.eth.Contract(UNISWAP_V2_FACTORY_ABI, config.dexs[0].factoryAddress)

	let index = synced_pair_count
	let totalLength = 0

	while (true) {
		index++

		if (index >= totalLength) {
			totalLength = await uniswapV2Factory.methods.allPairsLength().call()
			totalLength = parseInt(totalLength)

			if (index >= totalLength) {
				break
			}
		}

		let pair = await pairCollection.findOne({ index })
		let pairContract

		if (!pair) {
			pair = {}

			pair.index = index
			pair.address = await uniswapV2Factory.methods.allPairs(index).call()

			pairContract = new web3.eth.Contract(UNISWAP_V2_PAIR_ABI, pair.address)

			pair.token0 = await pairContract.methods.token0().call()
			pair.token1 = await pairContract.methods.token1().call()

			await pairCollection.insertOne(pair)

			console.log(`#${index}th pair was scanned`)
		}

		synced_pair_count = index
		await configCollection.updateOne({}, { $set: { [synced_pair_count_field]: synced_pair_count } })
	}

	console.log('\nAll pairs were scanned')

	process.exit(0)
}

scanPair()
