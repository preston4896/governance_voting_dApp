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
        this.setState({contractDeployed: false});

        const web3 = window.web3;
        const accounts = await web3.eth.getAccounts();

        this.setState({account: accounts[0]});

        let balanceInWei = await web3.eth.getBalance(this.state.account);
        let balance = web3.utils.fromWei(balanceInWei, "ether");
        this.setState({accountBalance: balance});

        const networkId = await web3.eth.net.getId();
        this.setState({network: networkId});

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
            this.setState({contractDeployed: true});
         }).catch((error) => {
            window.alert("The contract is not deployed to this network.");
         })

        // load user and app info from the contract. - getter functions should not cost any gas.
        // block number
        const vote = this.state.voteContract;
        let blockNumber = await vote.methods.lastBlockNumber().call();
        this.setState({lastSyncedBlock: blockNumber});

        this.setState({loading: false}); // App finished loading.
    }

    constructor(props) {
        super(props);
        this.state = {
            // account info
            account: "0x0",
            accountBalance: "0",

            // user-staking info
            amountDeposited: "0",
            amountWithdrawable: "0",
            userOwnedProp: "0",

            // network info
            network: "-1",
            lastSyncedBlock: "0",
            totalProp: "0",

            // contract
            voteContract: {},
            contractDeployed: false, // do not load anything when the contract is not deployed to the select network.

            // misc app state
            loading: true // the page is loading when a user is interacting with Metamask.
        }
    }
    
    render() {
        let welcomeMessage;
        let info;
        let footer = <p> &copy; 2021 Copyrights Reserved by Preston Ong </p>;
        if (this.state.loading) {
            welcomeMessage = <p> Loading... </p>;
        }
        else {
            // TODO: add more components here.
            if (this.state.contractDeployed) {
                info = 
                <div>
                    <div className = "row"> 
                        <div className = "col"> <p> Total staked: {this.state.amountDeposited} ETH </p> </div>
                        <div className = "col"> <p> Withdrawable amount: {this.state.amountWithdrawable} ETH </p>  </div>
                    </div>
                    <p> You created {this.state.userOwnedProp} proposal(s). You may create a new one or vote on active proposals. </p>
                    <p> A minimum of 0.001 ETH is required to create a new proposal. </p>
                    <AppBody/>
                </div>;
                footer = 
                <footer> 
                    <div className = "container">
                        <div className = "row">
                            <div className = "col"> Total Proposals: {this.state.totalProp} </div>
                            <div className = "col"> <p> Last Synced Block Number: {this.state.lastSyncedBlock} </p> </div>
                        </div>
                    </div>
                </footer>;
            }
            welcomeMessage = 
                <div className = "container"> 
                    <h2> Welcome, {this.state.account}! </h2>
                    <h3> Your current balance is {this.state.accountBalance} ETH </h3>
                </div>;
        }

        return (   
            <div className = "container text-center text-break">
                <h1> Preston's Voting dApp </h1>
                {welcomeMessage}
                {info}
                {footer}
            </div>
        );
    }

    async componentDidMount() {
        await this.loadWeb3();
        await this.loadData();
        // listen for network change
        await window.ethereum.on('chainChanged', () => {
            this.setState({loading: true});
            this.loadData();
        })

        // listen for account change
        await window.ethereum.on('accountsChanged', () => {
            this.setState({loading: true});
            this.loadData();
        })
    }
}

// TODO
function AppBody(props) {
    return (
        <div className = "container">
            <div className = "row d-flex align-items-center justify-content-between">
                <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button> Search or Vote On Proposal(s) </button> </div> 
                <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button> Find My Proposals </button> </div>
                <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button> Create A Proposal and Stake ETH </button> </div>
                <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button> Update ETH </button> </div>
                <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button> Withdraw ETH </button> </div>
            </div>
        </div>
    )
}

// load the components to root div in index.html
ReactDOM.render(
    <App/>,
    document.getElementById("root")
)