const HDWalletProvider = require('@truffle/hdwallet-provider');

const {mnemonic, infuraApiKey, etherscanApiKey} = require("./secrets.json");

module.exports = {
  /**
   * Networks define how you connect to your ethereum client and let you set the
   * defaults web3 uses to send transactions. If you don't specify one truffle
   * will spin up a development blockchain for you on port 9545 when you
   * run `develop` or `test`. You can ask a truffle command to use a specific
   * network from the command line, e.g
   *
   * $ truffle test --network <network-name>
   */

  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    development: {
     host: "127.0.0.1",     // Localhost (default: none)
     port: 7545,            // Standard Ethereum port (default: none)
     network_id: "*",       // Any network (default: none)
    },
    goerli: {
      // etherscan: https://goerli.etherscan.io/address/0x3418f4f8a01f51750bc448ecd624ebb669d82672
      provider: () => new HDWalletProvider(
        mnemonic, `wss://goerli.infura.io/ws/v3/${infuraApiKey}`
      ),
      network_id: 5,
      skipDryRun: true
    },
    rinkeby: {
      // etherscan: https://rinkeby.etherscan.io/address/0xfade7649a885efd05574bc9872568ef7ff72c40b
      provider: () => new HDWalletProvider(
        mnemonic, `wss://rinkeby.infura.io/ws/v3/${infuraApiKey}`
      ),
      network_id: 4,
      skipDryRun: true
    },
    ropsten: {
      provider: () => new HDWalletProvider(
        mnemonic, `wss://ropsten.infura.io/ws/v3/${infuraApiKey}`
      ),
      network_id: 3,
      skipDryRun: true
    }
  },

  // define contracts directory
  contracts_directory: "./src/contracts",
  contracts_build_directory: "./src/builds",
  migrations_directory: "./src/migrations",

  mocha: {
    enableTimeouts: false
  },

  // Truffle plug-ins
  plugins: [
    'truffle-plugin-verify'
  ],

  // Etherscan API
  api_keys: {
    etherscan: etherscanApiKey
  }
};
