require('dotenv').config()

const hre = require('hardhat')

const Web3 = require('web3')

const {
	MongoClient
} = require('mongodb')

let config

if (hre.network.name === 'eth') {
	config = require('./config/eth.json')
} else if (hre.network.name === 'bsc') {
	config = require('./config/bsc.json')
}

const DB_NAME = 'arbitrage-bot'
const COLLECTION_CONFIG = 'config'
const COLLECTION_ETH_PAIR = 'ethpair'
const COLLECTION_BSC_PAIR = 'bscpair'

const web3 = new Web3(new Web3.providers.HttpProvider(hre.network.config.url))

const mongoClient = new MongoClient(process.env.MONGODB_URI)
const mongodb = mongoClient.db(DB_NAME)
const configCollection = mongodb.collection(COLLECTION_CONFIG)
const ethPairCollection = mongodb.collection(COLLECTION_ETH_PAIR)
const bscPairCollection = mongodb.collection(COLLECTION_BSC_PAIR)

let synced_pair_count_field
let pairCollection

if (hre.network.name === 'eth') {
	synced_pair_count_field = 'synced_ethpair_count'
	pairCollection = ethPairCollection
} else if (hre.network.name === 'bsc') {
	synced_pair_count_field = 'synced_bscpair_count'
	pairCollection = bscPairCollection
}

module.exports = {
	config,
	web3,
	configCollection,
	pairCollection,
	synced_pair_count_field,
}