"strict mode";

class App extends React.Component {

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
            window.alert("Browser does not support Web3. Consider installing MetaMask.");
        }
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
    }
}

// load the components to main div in index.html
ReactDOM.render(
    <App/>,
    document.getElementById("root")
)