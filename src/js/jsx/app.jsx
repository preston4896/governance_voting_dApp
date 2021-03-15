"strict mode";

// web3 global functions

/**
 * checks for web3-compatible wallet
 */
async function loadWeb3() {
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
};

/**
 * load user's account and contract
 */
async function loadData() {
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
};

class App extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            // account info
            account: "0x0",
            accountBalance: "0",

            // user-staking info
            amountDeposited: "0",
            amountWithdrawable: "0",

            // network info
            network: "-1",
            lastSyncedBlock: "0",

            // contract
            voteContract: {},
            contractDeployed: false, // do not load anything when the contract is not deployed to the select network.

            // misc app state
            loading: true // the page is loading when a user is interacting with Metamask.
        }

        // bind fucntions
        loadWeb3 = loadWeb3.bind(this);
        loadData = loadData.bind(this);
    }
    
    render() {
        let welcomeMessage;
        let info;
        let footer = <p> &copy; 2021 Copyrights Reserved by Preston Ong </p>;
        if (this.state.loading) {
            welcomeMessage = <p> Loading... </p>;
        }
        else {
            if (this.state.contractDeployed) {
                info = 
                <div>
                    <div className = "row"> 
                        <div className = "col"> <p> Total staked: {this.state.amountDeposited} ETH </p> </div>
                        <div className = "col"> <p> Withdrawable amount: {this.state.amountWithdrawable} ETH </p>  </div>
                    </div>
                    <p> Select An Option Below To Begin. </p>
                    <p> A minimum of 0.001 ETH is required to create a new proposal. </p>
                    <AppBody contract = {this.state.voteContract}/>
                </div>;
                footer = 
                <footer> 
                    <div className = "container">
                        <div className = "row">
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
        await loadWeb3();
        await loadData();
        // listen for network change
        await window.ethereum.on('chainChanged', () => {
            this.setState({loading: true});
            loadData();
        })

        // listen for account change
        await window.ethereum.on('accountsChanged', () => {
            this.setState({loading: true});
            loadData();
        })
    }
}

class AppBody extends React.Component {

    /**
     * Load the total proposal count or the number of proposal created.
     * @param {Boolean} callerIsOwner
     * @returns {Number}
     */
    async loadPropCount(callerIsOwner) {
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        const sender = accounts[0];
        let res;
        if (callerIsOwner) {
            res = await vote.methods.myProposal_count(sender).call();
        }
        else {
            res = await vote.methods.total_proposals().call();
        }
        return res;
    }

    constructor(props) {
        super(props);
        this.state = {
            componentState: "home",
            transactionFailed: false,
            loading: false,
            anyProp: true, // true if the user is looking for their own proposals.
            propCount: 0
        }
        this.propHandler = this.propHandler.bind(this);
        this.propOwnHandler = this.propOwnHandler.bind(this);
        this.backHandler = this.backHandler.bind(this);
        this.loadPropCount = this.loadPropCount.bind(this);
    }

    // prop button handler
    async propHandler() {
        this.setState({loading: true});
        let count = await this.loadPropCount(false);
        this.setState({propCount: count});
        this.setState({componentState: "prop"});
        this.setState({anyProp: true});
        this.setState({loading: false});
    }
    async propOwnHandler() {
        this.setState({loading: true});
        let count = await this.loadPropCount(true);
        this.setState({propCount: count});
        this.setState({componentState: "prop"});
        this.setState({anyProp: false});
        this.setState({loading: false});
    }

    // back button handler
    backHandler() {
        this.setState({transactionFailed: false});
        this.setState({componentState: "home"});
    }

    render() {
        let content;
        if (this.state.loading) {
            content = <p> Loading... </p>
        }
        else {
            if (this.state.transactionFailed) {
                content = 
                <div className = "container">
                    <p> Error: The transaction did not go through. Please try again. </p>
                    <BackButton handler = {this.backHandler}/>
                </div>
            }
            else {
                if (this.state.componentState == "home") {
                    content = 
                    <div className = "row d-flex align-items-center justify-content-between">
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "Locate A Proposal By Their IDs." onClick = {this.propHandler}> Search or Vote On Proposal(s) </button> </div> 
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "View The Proposals That You Created." onClick = {this.propOwnHandler}> Find My Proposals </button> </div>
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "A minimum of 0.001 ETH is required."> Create A Proposal and Stake ETH </button> </div>
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "Update Your Total Withdrawable ETH Amount."> Update ETH </button> </div>
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "Withdraw all ETH to your wallet. Make sure to update withdrawable ETH first."> Withdraw ETH </button> </div>
                    </div>
                }
                else if (this.state.componentState == "prop") {
                    // load the proposal here.
                    let prop_count;

                    if (this.state.anyProp) {
                        prop_count = 
                        <div className = "container">
                            <p> Proposal Count: {this.state.propCount} </p>
                        </div>
                    }
                    else {
                        prop_count = 
                        <div className = "container">
                            <p> You have created {this.state.propCount} proposals so far. </p>
                        </div>
                    }

                    content = 
                    <div className = "container">
                        {prop_count}
                        <PropComponent isAny = {this.state.anyProp} contract = {this.props.contract}/>
                        <BackButton handler = {this.backHandler}/>
                    </div>
                }
            }
        }

        return (
            <div className = "container">
                {content}
            </div>
        )
    }
}

// --- HELPER FUNCTIONS AND COMPONENTS ---

function BackButton(props) {
    return (
        <button onClick = {props.handler}> Back </button>
    )
}

class PropComponent extends React.Component {
    
    /**
     * Load a proposal by the given query (ID or ownerIndex).
     * @param {Number} query - The proposalID or the index to query the owner's proposal.
     * @param {Boolean} callerIsOwner - True: query IDs; False: query indices.
     * @returns {Object} The Proposal Object. { uint256 id, address proposer, string title, uint256 yay_count, uint256 nay_count, uint256 total_deposit, uint256 begin_block_number, uint256 end_block_number }
     */
     async loadProposal(query, callerIsOwner) {
        const vote = this.props.contract;
        let resItem = new Array(8);
        try {
            resItem = await votes.methods.get_proposals(query, callerIsOwner).call(8);
        } catch (error) {
            window.alert("Unable to load proposal.");
        }
        let res = 
        {
            id: resItem[0],
            proposer: resItem[1],
            title: resItem[2],
            yay_count: resItem[3],
            nay_count: resItem[4],
            total_deposit: resItem[5],
            begin_block_number: resItem[6],
            end_block_number: resItem[7]
        }
        return res;
    }
    
    constructor(props) {
        super(props);
    }

    render() {
        let body;
        if (this.props.isAny) {
            body = <p> General Proposal Component is here. </p>
        }
        else {
            body =  <p> Specific Proposal Component is here. </p>
        }
        return (
            <div className = "container">
                {body}
            </div>
        )
    }
}


// --- END OF HELPER FUNCTIONS ---

// load the components to root div in index.html
ReactDOM.render(
    <App/>,
    document.getElementById("root")
)