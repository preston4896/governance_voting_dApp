"strict mode";

class App extends React.Component {

    // checks for web3-compatible wallet
    async loadWeb3() {
        // web3 browser
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            await window.ethereum.enable();
        }
        // legacy web3 API
        else if (window.web3) {
            window.web3 = new Web3(window.web3.currentProvider);
        }
        else {
            let message = "Browser does not support Web3. Consider installing MetaMask.";
            let alert = confirm(message);
            if (alert) {
                window.open("https://metamask.io/", "_blank", "noopener, noreferrer");
            }
        }
    }

    // load user's account and contract
    async loadData() {
        const web3 = window.web3;
        const accounts = await web3.eth.getAccounts();

        this.setState({account: accounts[0]});

        let balanceInWei = await web3.eth.getBalance(this.state.account);
        let balance = web3.utils.fromWei(balanceInWei, "ether");
        this.setState({accountBalance: balance});

        const networkId = await web3.eth.net.getId();

        // load the contract
        let abi;
        let address;
        await fetch("./src/builds/Vote.json")
         .then(body => body.json())
         .then(data => {
            abi = data.abi;
            address = data.networks[networkId].address;
            const vote = new web3.eth.Contract(abi, address);
            this.setState({voteContract: vote});
         }).catch((error) => {
            window.alert("The contract is not deployed to this network.");
         })

         this.setState({loading: false}); // App finished loading.
    }

    constructor(props) {
        super(props);
        this.state = {
            account: "0x0",
            voteContract: {},
            loading: true, // the page is loading when a user is interacting with Metamask.
            accountBalance: "0"
        }
    }
    
    render() {
        let content;
        if (this.state.loading) {
            content = <p> Loading account info. Please connect your wallet to this app on Metamask. </p>;
        }
        else {
            content = <div> 
                <h2> Welcome, {this.state.account}! </h2>
                <p> Your current ETH balance is {this.state.accountBalance} ETH! </p>
            </div>
        }

        return (   
            <div>
                <h1> Preston's Voting dApp </h1>
                {content}
            </div>
        );
    }

    async componentDidMount() {
        await this.loadWeb3();
        await this.loadData();
    }
}

// load the components to main div in index.html
ReactDOM.render(
    <App/>,
    document.getElementById("root")
)