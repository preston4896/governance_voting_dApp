"strict mode";

class App extends React.Component {

    /**
     * checks for web3-compatible wallet
     */
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
    };

    /**
     * load the contract
     */
    async loadContract() {
        this.setState({loading: true});
        this.setState({contractDeployed: false});

        const web3 = window.web3;

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

        await this.loadData();

        this.setState({loading: false}); // App finished loading.
    };

    /**
     * Gets the last block number prossessed by the contract, account info, user staked and withdrawable.
     */
    async loadData() {
        const vote = this.state.voteContract;
        const web3 = window.web3;
        
        // block number
        let blockNum = await vote.methods.lastBlockNumber().call();
        this.setState({lastSyncedBlock: blockNum});

        // account info
        const accounts = await web3.eth.getAccounts();
        this.setState({account: accounts[0]});
        let balanceInWei = await web3.eth.getBalance(this.state.account);
        let balance = web3.utils.fromWei(balanceInWei, "ether");
        this.setState({accountBalance: balance});

        // deposit info
        const stakedInWei = await vote.methods.get_staked().call({from:this.state.account});
        const staked = web3.utils.fromWei(stakedInWei, "ether");
        this.setState({amountDeposited: staked});

        // withdraw info
        const withdrawableInWei = await vote.methods.get_withdraw().call({from:this.state.account});
        const withdrawable = web3.utils.fromWei(withdrawableInWei, "ether");
        this.setState({amountWithdrawable: withdrawable});
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
        this.loadWeb3 = this.loadWeb3.bind(this);
        this.loadContract = this.loadContract.bind(this);
        this.loadData = this.loadData.bind(this);
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
                    <p> A minimum of 0.001 ETH is required to create a new proposal. </p>
                    <AppBody contract = {this.state.voteContract} refresh = {this.loadData}/>
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
        await this.loadWeb3();
        await this.loadContract();
        // listen for network change
        await window.ethereum.on('chainChanged', () => {
            this.loadContract();
        })

        // listen for account change
        await window.ethereum.on('accountsChanged', () => {
            this.loadData();
        })
    }
}

class AppBody extends React.Component {

    /**
     * Load the total proposal count or the number of proposal created.
     * @param {Boolean} callerIsVoter
     * @returns {Number}
     */
    async loadPropCount(callerIsVoter) {
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        const sender = accounts[0];
        let res;
        if (callerIsVoter) {
            res = await vote.methods.myProposal_count(sender).call();
        }
        else {
            res = await vote.methods.total_proposals().call();
        }
        return res;
    }

    /**
     * Loads the current block number.
     */
    async getCurrentBlockNumber() {
        const blockNum = await window.web3.eth.getBlockNumber();
        this.setState({currentBlockNumber: blockNum});
    }

    constructor(props) {
        super(props); // props.contract: stores contact ABI
        this.state = {
            // App Stats
            componentState: "home",
            bodyLoading: false,
            transactionFailed: false,

            // Proposal Stats
            anyProp: true, // false if the user is looking for their own proposals.
            propCount: 0,
            
            // New Proposal Info
            newTitle: "",
            newOffset: "",
            amount: "0.001",

            // Network
            currentBlockNumber: 0
        }

        // Binding functions
        this.propHandler = this.propHandler.bind(this);
        this.propOwnHandler = this.propOwnHandler.bind(this);
        this.backHandler = this.backHandler.bind(this);
        this.createHandler = this.createHandler.bind(this);
        this.titleHandler = this.titleHandler.bind(this);
        this.offsetHandler = this.offsetHandler.bind(this);
        this.depositHandler = this.depositHandler.bind(this);
        this.submitHandler = this.submitHandler.bind(this);
        this.redeemHandler = this.redeemHandler.bind(this);
    }

    // prop button handler
    async propHandler() {
        this.setState({bodyLoading: true});
        let count = await this.loadPropCount(false);
        this.setState({propCount: count});
        this.setState({componentState: "prop"});
        this.setState({anyProp: true});
        this.setState({bodyLoading: false});
        await this.props.refresh();
    }
    async propOwnHandler() {
        this.setState({bodyLoading: true});
        let count = await this.loadPropCount(true);
        this.setState({propCount: count});
        this.setState({componentState: "prop"});
        this.setState({anyProp: false});
        this.setState({bodyLoading: false});
        await this.props.refresh();
    }

    // create button handler
    async createHandler() {
        this.setState({bodyLoading: true});
        this.setState({componentState: "create"});
        this.setState({bodyLoading: false});
        await this.props.refresh();
    }

    // back button handler
    async backHandler() {
        this.setState({transactionFailed: false});
        this.setState({componentState: "home"});
        await this.props.refresh();
    }

    // update proposal title
    titleHandler(event) {
        this.setState({newTitle: event.target.value});
    }

    // update offset
    offsetHandler(event) {
        this.setState({newOffset: event.target.value});
    }

    // deposit handler
    depositHandler(event) {
        this.setState({amount: event.target.value});
    }

    // submit then initiate transaction.
    async submitHandler() {
        const inputsAreValid = (this.state.newTitle !== "") && (this.state.newOffset !== "") && (parseFloat(this.state.amount) >= 0.001);
        if (inputsAreValid) {
            this.setState({bodyLoading: true});

            const accounts = await window.web3.eth.getAccounts();
            const sender = accounts[0];
            const vote = this.props.contract;

            const weiAmount = web3.utils.toWei(this.state.amount.toString(), "ether");
            const estimateGasLimit = await vote.methods.create(this.state.newTitle, this.state.newOffset).estimateGas({from: sender, value: weiAmount});

            // submit proposal
            try {
                await vote.methods.create(this.state.newTitle, this.state.newOffset).send({from: sender, value: weiAmount, gas: estimateGasLimit})
                .on("transactionHash", (hash) => {
                    this.setState({bodyLoading: false});
                    this.setState({newTitle: ""});
                    this.setState({newOffset: ""});
                    this.setState({amount: "0.001"});
                    this.setState({componentState: "home"});
                    window.alert("Your Proposal Has Been Successfully Created.");
                })
                .on("error", (error) => {
                    this.setState({bodyLoading: false});
                    this.setState({transactionFailed: true});
                    console.error("Transaction failed (Preston)", error);
                });
            } catch (error) {
                this.setState({bodyLoading: false});
                this.setState({transactionFailed: true});
                console.error("Rejection hurts (Preston)", error);
            }
        }
        else {
            this.setState({componentState: "create"});
        }
    }

    // TODO: Update ETH and Withdraw ETH.
    async redeemHandler() {
        
    }

    render() {
        let content;
        if (this.state.bodyLoading) {
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
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "A minimum of 0.001 ETH is required." onClick = {this.createHandler}> Create A Proposal and Stake ETH </button> </div>
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "Redeem Your Total Withdrawable ETH Amount." onClick = {this.redeemHandler}> Redeem ETH </button> </div>
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "Withdraw all ETH to your wallet. Make sure to redeem withdrawable ETH first."> Withdraw ETH </button> </div>
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
                            <p> You have created or voted on {this.state.propCount} proposal(s) so far. </p>
                        </div>
                    }

                    content = 
                    <div className = "container">
                        {prop_count}
                        <ViewPropComponent isAny = {this.state.anyProp} contract = {this.props.contract}/>
                        <BackButton handler = {this.backHandler}/>
                    </div>
                }
                else if (this.state.componentState == "create") {
                    content = 
                    <div className = "container">
                        <div className = "col" style = {{margin: "10px", border: "dashed black"}}>
                            <p> New Proposal </p>
                            <div className = "row">
                                <label>
                                    Title:
                                    <input type = "text" style = {{margin: "3px"}} value = {this.state.newTitle} onChange = {this.titleHandler}/>
                                </label>
                            </div>
                            <div className = "row">
                                <label>
                                    End Block Number Offset:
                                    <input type = "number" min = "1" style = {{margin: "3px"}} value = {this.state.newOffset} onChange = {this.offsetHandler}/>
                                </label>
                            </div>
                            <div className = "row">
                                <label>
                                    Deposit Amount:
                                    <input type = "number" min = "0.001" style = {{margin: "3px"}} value = {this.state.amount} onChange = {this.depositHandler}/>
                                </label>
                            </div>
                            <button onClick = {this.submitHandler}> Submit </button>
                        </div>
                        <p> Current Block Number: {this.state.currentBlockNumber} </p>
                        <p> An average block time is approximately 10-20 seconds (Mainnet, Rinkeby and Goerli). An offset of 1 would mean that your proposal would only last for 20 seconds at most. </p>
                        <p style = {{fontStyle: "strong", color: "red"}}> WARNING: You must deposit more than 0.001 ETH, otherwise the transaction will fail. </p>
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

    // live-render block number
    async componentDidUpdate() {
        await this.getCurrentBlockNumber();
    }
}

// --- HELPER FUNCTIONS AND COMPONENTS ---

function BackButton(props) {
    return (
        <button onClick = {props.handler}> Back </button>
    )
}

// TODO
class ViewPropComponent extends React.Component {
    
    /**
     * Load a proposal by the given query (ID or ownerIndex).
     * @param {Number} query - The proposalID or the index to query the owner's proposal.
     * @param {Boolean} callerIsVoter - True: query IDs; False: query indices.
     * @returns {Object} The Proposal Object. { uint256 id, address proposer, string title, uint256 yay_count, uint256 nay_count, uint256 total_deposit, uint256 begin_block_number, uint256 end_block_number }
     */
    async loadProposal(query, callerIsVoter) {
        const vote = this.props.contract;
        let resItem = new Array(8);
        try {
            resItem = await votes.methods.get_proposals(query, callerIsVoter).call(8);
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
    
    /**
     * Initialize the Proposal Component
     * @param {object} props - props.contract: contract ABI, props.isAny: True, if user is looking for any proposal. False otherwise, user is looking for their own proposal.
     */
    constructor(props) {
        super(props);
        this.state = {
            proposal: undefined
        }
    }

    render() {
        let body;
        let propBody;

        // proposalBody component
        if (!this.state.proposal) {
            propBody = 
            <div className = "container"> 
                <p> Waiting to fetch proposal... </p>
            </div>
        }
        else {
            propBody = 
            <div className = "container"> 
                
            </div>
        }

        // page body component
        if (this.props.isAny) {
            body = 
            <div className = "container-fluid">
                <div className = "row">
                    <div className = "col"> 
                        <input placeholder = "Enter Proposal ID"/>
                        <button> Search </button>
                    </div>
                </div>
                {propBody}
            </div>
        }
        else {
            body = 
            <div className = "container-fluid">
               <div className = "row">
                    <div className = "col"> 
                        <input placeholder = "Enter Index Number"/>
                        <button> Search </button>
                    </div>
                </div>
                {propBody}
            </div>
        }

        return (
            <div className = "container" style = {{border: "dotted black", margin: "10px"}}>
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