import chalk from 'chalk';
import { createAlchemyWeb3 } from '@alch/alchemy-web3';
import PromiseQueue from './promiseQueue.js';
import {
  RPC_NODE,
  HTTPS_NODE,
  ALCHEMY_AK,
  GAS_TRACKER_DELAY,
  TRANSFERFROM_ABI,
} from './config.js';

/**
 * 钱包助手
 */
class WalletHelper {
  web3Https;
  web3Rpc;
  queue;
  timer;
  constructor() {
    this.web3Https = createAlchemyWeb3(`${HTTPS_NODE}/v2/${ALCHEMY_AK}`);
    this.web3Rpc = createAlchemyWeb3(`${RPC_NODE}/v2/${ALCHEMY_AK}`);
    this.queue = new PromiseQueue();
  }

  signTx = (wallet, fields = {}, nonce) => {
    return new Promise((resolve, reject) => {
      const transaction = {
        nonce: nonce,
        ...fields,
      };
      console.log(chalk.yellow(`✍️ 签名中...`));
      this.web3Rpc.eth.accounts.signTransaction(transaction, wallet?.pk)
        .then(res => {
          resolve(res);
        }).catch((err) => {
          reject(err);
        });
    });
  }

  sendTx = (signedTx) => {
    return new Promise((resolve, reject) => {
      if (!signedTx?.rawTransaction) {
        console.log(chalk.red('❌ 交易异常!'));
        reject(new Error('❌ 交易异常!'));
        return;
      }
      console.log(chalk.yellow(`📧 发送交易中...`));
      this.web3Rpc.eth.sendSignedTransaction(signedTx.rawTransaction, (error, hash) => {
        if (!error) {
          console.log(chalk.green(`✅ 交易发送成功 ${hash}`));
          resolve(hash);
        } else {
          console.log('Something went wrong while submitting your transaction:', error);
          reject(new Error('Something went wrong while submitting your transaction:', error))
        }
      });
    });
  }

  estimateGas = (wallet, data, contractAddress) => {
    return new Promise((resolve, reject) => {
      console.log(chalk.yellow(`♻️ ${wallet.address} 正在同步当前gas...`));
      this.web3Rpc.eth.estimateGas({
        from: wallet.address,
        data: data,
        to: contractAddress,
        value: 0,
      }).then(async (estimatedGas) => {
        resolve(estimatedGas);
      }).catch(err => {
        console.error('❌ 计算gas异常')
        reject(err);
      });
    });
  }

  watchTransaction = (hash) => {
    return new Promise((resolve, reject) => {
      let tail = '';
      const interval = setInterval(() => {
        tail += '.'
        console.log(chalk.yellow('监听交易状态中' + tail));
        this.web3Rpc.eth.getTransactionReceipt(hash, (err, rec) => {
          if (err || !rec) {
            console.log(chalk.red('❌ 监听交易异常'));
            reject('❌ 监听交易异常');
          } else {
            const { status } = rec;
            if (status) {
              resolve();
            } else {
              reject('❌ 交易返回状态异常');
            }
          }
          clearInterval(interval);
        });
      }, 1000);
    });
  }

  getNftsByContract = (wallet, contractAddress) => {
    return new Promise(async (resolve, reject) => {
      try {
        resolve(await this.web3Https.alchemy.getNfts({
          owner: wallet.address,
          contractAddresses: [contractAddress]
        }));
      } catch (error) {
        console.error(error);
        reject(new Error(`❌ 查询 ${wallet.address} NFT异常`));
      }
    });
  }

  transferFrom = (fromWallet, toWallet, targetNFT, nonce) => {
    return new Promise(async (resolve, reject) => {
      const contract = new this.web3Rpc.eth.Contract(TRANSFERFROM_ABI, targetNFT.contract.address);
      const inputData = contract.methods.transferFrom(
        fromWallet.address,
        toWallet.address,
        targetNFT.id.tokenId).encodeABI();
      const gas = await this.estimateGas(fromWallet, inputData, targetNFT.contract.address);
      console.log(chalk.yellow(`预计消耗gas ${gas}`));
      const fields = {
        from: fromWallet.address,
        to: targetNFT.contract.address,
        gas,
        data: inputData,
      }
      const signedTx = await this.signTx(fromWallet, fields, nonce);
      this.sendTx(signedTx);
      resolve();
    });
  }

  transferNFT = (fromWallet, toWallet, contractAddress) => {
    return new Promise(async (resolve, reject) => {
      try {
        const nonce = await this.web3Rpc.eth.getTransactionCount(fromWallet.address, 'latest');
        console.log(chalk.yellow(`nonce: ${nonce}`));

        console.log(chalk.yellow('查询合约下的NFT'));
        const { ownedNfts } = await this.getNftsByContract(fromWallet, contractAddress);
        console.log(ownedNfts);
        if (ownedNfts && ownedNfts.length) {
          console.log(chalk.green(`持有NFT数: ${ownedNfts.length}`));
          ownedNfts.forEach(async (nft, i) => {
            this.transferFrom(fromWallet, toWallet, nft, nonce + i);
          });
          resolve();
        } else {
          reject(new Error(`${fromWallet.address} 无目标NFT`));
        }
      } catch (error) {
        reject(new Error(`❌ 转移 ${fromWallet.address} NFT异常`));
      }
    });
  }

  waitingForGas = (target) => {
    return new Promise(async (resolve, reject) => {
      if (!target) {
        console.log(chalk.red('❌ 无效的目标 basefee'));
        return reject('❌ 无效的目标 basefee');
      }

      this.timer && clearTimeout(this.timer);
      const gas = await this.web3Rpc.eth.getGasPrice();
      console.log(gas)
      const current = Number(this.web3Rpc.utils.fromWei(gas, 'gwei')).toFixed(2);

      if (current < 20) {
        console.log(chalk.green(current));
      } else if (current < 50) {
        console.log(chalk.yellow(current));
      } else {
        console.log(chalk.red(current));
      }

      if (gas && current && current <= target) {
        console.log(chalk.green(`当前basefee ${current} gwei`));
        resolve(gas);
      } else {
        this.timer = setTimeout(() => this.waitingForGas(target), GAS_TRACKER_DELAY);
      }
    });
  }
}
export default WalletHelper;