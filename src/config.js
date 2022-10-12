// test测试网， main主网
const currENV = 'test';
// *****************************************************

const RPC_ENV = {
  main: 'wss://eth-mainnet.alchemyapi.io',
  test: 'wss://eth-goerli.ws.alchemyapi.io'
};

const HTTPS_ENV = {
  main: 'https://eth-mainnet.alchemyapi.io/nft',
  test: 'https://eth-goerli.alchemyapi.io/nft'
};

export const RPC_NODE = RPC_ENV[currENV];

export const HTTPS_NODE = HTTPS_ENV[currENV];

// 去alchemy 申请的appkey
export const ALCHEMY_AK = '申请的alchemy key';
// 每5s检查一次gas
export const GAS_TRACKER_DELAY = 5 * 1000;

// ERC721 的转移函数
export const TRANSFERFROM_ABI = [{
  "inputs": [
    {
      "internalType": "address",
      "name": "from",
      "type": "address"
    },
    {
      "internalType": "address",
      "name": "to",
      "type": "address"
    },
    {
      "internalType": "uint256",
      "name": "tokenId",
      "type": "uint256"
    }
  ],
  "name": "transferFrom",
  "outputs": [],
  "stateMutability": "nonpayable",
  "type": "function"
}]