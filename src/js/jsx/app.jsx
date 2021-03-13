"strict mode";

class App extends React.Component {

    // checks for web3-compatible wallet
    async loadWeb3() {
        // web3 browser
        if (window.ethereum) {
            window.web3 = new Web3(window.ethereum);
            await window.ethereum.enable();
        }
        // browser with web3 extension (Metamask)
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
    }

    constructor(props) {
        super(props);
        this.state = {
            account: "0x0",
            voteContract: {},
            loading: true // the page is loading when a user is interacting with Metamask.
        }
    }
    
    render() {
        return <h1> Hello, world! </h1>;
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