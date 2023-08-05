1. Environment

- Node install

# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh
# curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
# source ~/.bashrc
# nvm list-remote
# nvm install v18.17.0

- Mongodb install

# apt update
# curl -fsSL https://www.mongodb.org/static/pgp/server-6.0.asc|sudo gpg --dearmor -o /etc/apt/trusted.gpg.d/mongodb-6.gpg
# echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/6.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-6.0.list
# apt update
# apt install mongodb-org
# systemctl enable --now mongod


2. Run the bot

- Please install node modules first.

# npm install

- After install node modules, then deploy the bot smart contract.

# npm run deploy --network=<network>

For example:
# npm run deploy --network=eth
or
# npm run deploy --network=bsc

- After deploy the bot smart contract, then verify it.

# npm run verify --network=<network> --address=<contract_address>

For example:
# npm run verify --network=eth --address=0x0e2469f2703628049F88403D0bd1b838D6686964
or
# npm run verify --network=bsc --address=0x0e2469f2703628049F88403D0bd1b838D6686964

- After verify the bot smart contract, then scan all pairs in swap.

npm run scan --network=<network>

For example:
# npm run scan --network=eth
or
# npm run scan --network=bsc

- After scan all pairs, then start trade.

npm run trade --network=<network>

For example:
# npm run trade --network=eth
or
# npm run trade --network=bsc
