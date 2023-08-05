require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  networks: {
    eth: {
      url: process.env.ETH_RPC_HTTP_URL,
      gas: 3000000,
      accounts: ['75534a088e5224aa4707efaf7de55e23727ed764a86146bb53652d2282b002ea'],
    },
    bsc: {
      url: process.env.BSC_RPC_HTTP_URL,
      gas: 3000000,
      accounts: ['6f2b82c17d9d859b32a097295bc1dc60e88f5201262e9695d5369598b8b8b246'],
    },
  },
  solidity: {
    compilers: [
      { version: "0.8.7" },
      { version: "0.7.6" },
      { version: "0.6.6" }
    ]
  },
  etherscan: {
    apiKey: {
      eth: process.env.ETHERSCAN_API_KEY,
      bsc: process.env.BSCSCAN_API_KEY,
    }
  },
}
