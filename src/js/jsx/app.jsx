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
         }).catch((error) => {
            window.alert("The contract is not deployed to this network.");
         })

         this.setState({loading: false}); // App finished loading.
    }

    constructor(props) {
        super(props);
        this.state = {
            account: "0x0",
            network: "-1",
            voteContract: {},
            loading: true, // the page is loading when a user is interacting with Metamask.
            accountBalance: "0"
        }
    }
    
    render() {
        let welcomeMessage;
        let footer;
        if (this.state.loading) {
            welcomeMessage = <p> Loading... </p>;
            footer = <p> &copy; 2021 Copyrights Reserved by Preston Ong </p>;
        }
        else {
            welcomeMessage = 
                <div className = "container"> 
                    <h2> Welcome, {this.state.account}! </h2>
                    <p> Your current balance is {this.state.accountBalance} ETH! </p>
                </div>
            footer = 
                <footer> 
                    <div className = "container">
                        <div className = "row">
                            <div className = "col"> <p> &copy; 2021 Copyrights Reserved by Preston Ong </p> </div>
                            <div className = "col"> <p> Last Synced Block Number : 0 </p> </div>
                        </div>
                    </div>
                </footer>;
        }

        return (   
            <div className = "container text-center text-break">
                <h1> Preston's Voting dApp </h1>
                {welcomeMessage}
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

// load the components to root div in index.html
ReactDOM.render(
    <App/>,
    document.getElementById("root")
)