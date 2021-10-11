import { ethers, utils } from 'ethers';
import React, { useEffect, useState } from 'react';
import { Api } from '@cennznet/api';
import { hexToU8a, stringToHex, u8aToHex } from '@polkadot/util';
import { blake2AsHex } from '@polkadot/util-crypto';
import {encodeAddress} from '@polkadot/keyring';

function App() {
  const ethereum = window.ethereum;
  // A Web3Provider wraps a standard Web3 provider, which is
  // what Metamask injects as window.ethereum into each page
  const [cennznet, setCennznet] = useState();
  const [cennznetAddress, setCennznetAddress] = useState();
  const [cpayBalance, setCpayBalance] = useState();
  const [cennzBalance, setCennzBalance] = useState();
  const [account, setAccount] = useState();
  const [signature, setSignature] = useState();
  // The Metamask plugin also allows signing transactions to
  // send ether and pay to change state within the blockchain.
  // For this, you need the account signer...

  useEffect(async () => {
    const rpc = {
      ethWallet: {
        addressNonce: {
          params: [
            {
              name: 'ethAddress',
              type: '[u8; 20]'
            }
          ],
          type: 'u32'
        }
      }
    };
    let types = {
      ethWalletCall: {
        call: 'Call',
        nonce: 'u32',
      }
    };

    let cennznet_ = await Api
      .create({
        provider: 'ws://localhost:9944',
        rpc,
        types: {
          ethWalletCall: {
            call: 'Call',
            nonce: 'u32',
          }
        }
      });
    await cennznet_.isReady;
    setCennznet(cennznet_);
    console.log('cennznet connected');
  }, []);

  useEffect(async () => {
    if(!cennznetAddress) return;
    let cpayBalance_ = await cennznet.query.genericAsset.freeBalance(16001, cennznetAddress);
    let cennzBalance_ = await cennznet.query.genericAsset.freeBalance(16000, cennznetAddress);
    let cb1 = cennzBalance_.toString().slice(0, -4);
    let cb2 = cennzBalance_.toString().slice(-4);
    setCennzBalance(`${cb1}.${cb2}`);
    let cp1 = cpayBalance_.toString().slice(0, -4);
    let cp2 = cpayBalance_.toString().slice(-4);
    setCpayBalance(`${cp1}.${cp2}`);

  }, [cennznetAddress]);

  function connectMetamask() {
    ethereum.request({ method: 'eth_requestAccounts' }).then((accounts) => {
      setAccount(accounts[0]);
    })
  }

  const signMessage = async () => {
    let address = account;
    console.log(`got address: ${address}`);
    // TODO: query node about nonce for an Eth address (if it's empty return 0)
    // it it's set use that value
    let nonce = await cennznet.rpc.ethWallet.addressNonce(address);
    console.log(`got nonce: ${nonce}`);

    let message = "hello world";
    console.log(`remark: ${stringToHex(message)}`);

    let call = cennznet.tx.system.remark(message);
    let payload = cennznet.createType('ethWalletCall', { call, nonce }).toU8a();

    // TODO: this could become the "login" step
    // sign login message to derive CENNZnet address
    let signature_ = await ethereum.request({ method: 'personal_sign', params: [payload, address] });
    console.log(`signature: ${signature_}`);

    const msgHash = utils.hashMessage(payload);
    // CENNZnet recovers this compressed variant for conversion to address
    let ecdsaPublicKeyCompress = utils.computePublicKey(
      utils.recoverPublicKey(msgHash, signature_),
      true
    );
    // CENNZnet prints: eca51cdc998e42bfa50c6700804fd133fe87401512b9017dc304c4297776031f
    console.log(ecdsaPublicKeyCompress);
    let preAddress = blake2AsHex(utils.arrayify(ecdsaPublicKeyCompress));
    let cennznetAddress_ = encodeAddress(preAddress);
    console.log(`cennznet address: ${cennznetAddress_}`);
    setCennznetAddress(cennznetAddress_);
    setSignature(signature_);

    let txHash = await cennznet.tx.ethWallet.call(call, address, signature_).send();
    console.log(`tx sent: ${txHash}`);
  };

  return (
    <div className="App" style={{ fontFamily: 'helvetica neue', textAlign: 'center', justifyContent: 'center', alignContent: 'center' }}>
      <header className="App-header">
        <h1>CENNZnet/Metamask Demo 🦊</h1>
      </header>
      <div style={{ borderRadius: '16px', border: '1px black solid', overflow: 'hidden', padding: '1em'}}>
        <p>Ethereum Address: {account}</p>
        <p>CENNZnet address: {cennznetAddress}</p>
        <p>CPAY balance: {cpayBalance}</p>
        <p>CENNZ balance: {cennzBalance}</p>
        <p>signature: {signature}</p>

        <button style={{ cursor: 'pointer', height: '3em', padding: '0.5em', margin: '0.2em' }} onClick={() => connectMetamask()}>Connect</button>
        <button style={{ cursor: 'pointer', height: '3em', padding: '0.5em', margin: '0.2em' }}onClick={() => signMessage()}>Full Send!</button>
      </div>
    </div>
  );
}

export default App;
