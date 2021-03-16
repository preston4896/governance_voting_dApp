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

            // Proposal Stats - can only used for search proposals (option 1 or 2)
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
        this.withdrawHandler = this.withdrawHandler.bind(this);
        this.throwTransactionFailed = this.throwTransactionFailed.bind(this);
        this.home = this.home.bind(this);
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

            // submit proposal
            try {
                await vote.methods.create(this.state.newTitle, this.state.newOffset).send({from: sender, value: weiAmount})
                .on("transactionHash", (hash) => {
                    this.setState({newTitle: ""});
                    this.setState({newOffset: ""});
                    this.setState({amount: "0.001"});
                    this.setState({componentState: "home"});
                    this.props.refresh();
                    window.alert("Your Proposal Has Been Successfully Created.");
                })
                .on("error", (error) => {
                    this.setState({transactionFailed: true});
                    console.error("Transaction failed (Preston)", error);
                });
            } catch (error) {
                this.setState({transactionFailed: true});
                console.error("Rejection hurts (Preston)", error);
            }
            this.setState({bodyLoading: false});
        }
    }

    // Redeem ETH
    async redeemHandler() {
        this.setState({bodyLoading: true});
        const count = await this.loadPropCount(true);
        let message = "You have not created or voted on any proposals yet. It is unlikely that you would have accrued any redeemable ETH. Proceeding this option will incur a transaction (gas) fee. Continue?";
        let confirm;
        if (count == 0) {
            confirm = window.confirm(message);
        }
        if (confirm === false) {
            this.setState({bodyLoading: false});
            this.setState({componentState: "home"});
        } 
        if (count > 0 || confirm) {
            const vote = this.props.contract;
            
            const accounts = await window.web3.eth.getAccounts();
            const sender = accounts[0];

            // updating withdrawable
            try {
                await vote.methods.updateEthEarned().send({from: sender})
                .on("transactionHash", (hash) => {
                    window.alert("Your transaction has been confirmed.");
                })
                .on("error", (error) => {
                    this.setState({transactionFailed: true});
                    console.error("Transaction failed (Preston)", error);
                });
            } catch (error) {
                this.setState({transactionFailed: true});
                console.error("Rejection hurts (Preston)", error);
            }
            this.setState({bodyLoading: false});
            this.setState({componentState: "home"});
            await this.props.refresh();
        }
    }

    // Withdraw ETH.
    async withdrawHandler() {
        this.setState({bodyLoading: true});
        window.alert("Make sure that you clicked on Redeem ETH to claim all of your withdrawable ETH before withdrawing.");

        // load account info
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        const sender = accounts[0];

        // load balance
        const withdrawable = await vote.methods.get_withdraw().call({from: sender});

        if (withdrawable == 0) {
            window.alert("You do not have any withdrawable ETH.");
        }
        else {
            // withdraw accounts.
            try {
                await vote.methods.withdrawEth().send({from: sender})
                .on("transactionHash", (hash) => {
                    window.alert("Funds have been withdrawned.");
                })
                .on("error", (error) => {
                    this.setState({transactionFailed: true});
                    console.error("Transaction failed (Preston)", error);
                });
            } catch (error) {
                this.setState({transactionFailed: true});
                console.error("Rejection hurts (Preston)", error);
            }
        }

        this.setState({bodyLoading: false});
        this.setState({componentState: "home"});
        await this.props.refresh();
    }

    // take the user to the transaction failed page.
    throwTransactionFailed() {
        this.setState({transactionFailed: true});
    }

    // take the user back to the home page.
    home() {
        this.setState({componentState: "home"});
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
                        <div className = "row-sm-12 rol-md-6 rol-lg-2"> <button title = "Withdraw all ETH to your wallet. Make sure to redeem withdrawable ETH first." onClick = {this.withdrawHandler}> Withdraw ETH </button> </div>
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
                        <ViewPropComponent isAny = {this.state.anyProp} contract = {this.props.contract} err = {this.throwTransactionFailed} home = {this.home}/>
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

class ViewPropComponent extends React.Component {
    
    /**
     * Load a proposal by the given query (ID or ownerIndex).
     * @param {Number} query - The proposalID or the index to query the owner's proposal.
     * @param {Boolean} callerIsVoter - True: query IDs; False: query indices.
     * @returns {Object} The Proposal Object. { uint256 id, address proposer, string title, uint256 yay_count, uint256 nay_count, uint256 total_deposit, uint256 begin_block_number, uint256 end_block_number, uint256 max_deposit }
     */
    async loadProposal(query, callerIsVoter) {
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        let resItem = new Array(9);
        if (callerIsVoter) {
            query--;
        }
        try {
            resItem = await vote.methods.get_proposals(query, callerIsVoter).call({from: accounts[0]});
        } catch (error) {
            window.alert("Unable to load proposal.");
        }
        let res = 
        {
            id: resItem[0],
            proposer: resItem[1],
            title: resItem[2],
            yay_count: window.web3.utils.fromWei(resItem[3].toString(), "ether"),
            nay_count: window.web3.utils.fromWei(resItem[4].toString(), "ether"),
            total_deposit: window.web3.utils.fromWei(resItem[5].toString(), "ether"),
            begin_block_number: resItem[6],
            end_block_number: resItem[7],
            max_deposit: window.web3.utils.fromWei(resItem[8].toString(), "ether"),
        }
        return res;
    }

    /**
     * Fetches the caller's vote on a proposal given by id.
     * @param {Number} id
     * @returns {Number} 0 - undecided vote, 1 - yay vote, 2- nay vote. 
     */
    async fetchVote(id) {
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        const sender = accounts[0];

        const callerVote = await vote.methods.get_votes(id).call({from: sender});
        return callerVote;
    }
    
    /**
     * Initialize the Proposal Component
     * @param {object} props - props.contract: contract ABI; props.isAny: True, if user is looking for any proposal. False otherwise, user is looking for their own proposal; props.err: throws transaction failed page
     */
    constructor(props) {
        super(props);
        this.state = {
            // proposal state
            proposal: undefined,
            input: "",
            voted: "",
            currentBlockNumber: "",

            // component state
            yaySelected: false,
            naySelected: false,
            ethDeposited: "0"
        }

        // binding functions
        this.inputHandler = this.inputHandler.bind(this);
        this.voteHandler = this.voteHandler.bind(this);
        this.depositHandler = this.depositHandler.bind(this);
        this.submitVoteHandler = this.submitVoteHandler.bind(this);
    }

    // updates the input states to trigger didComponentUpdate() to reload proposal.
    async inputHandler(event) {
        if (event.target.value === "" || event.target.value === 0) {
            this.setState({proposal: undefined});
        }
        this.setState({input: event.target.value});
    }

    // Handles the user's votes.
    voteHandler(event) {
        if (event.target.value === "Yay" && event.target.checked) {
            this.setState({yaySelected: true});
            this.setState({naySelected: false});
        }
        else if (event.target.value === "Nay" && event.target.checked) {
            this.setState({yaySelected: false});
            this.setState({naySelected: true});
        }
    }

    // update user input deposit
    depositHandler(event) {
        this.setState({ethDeposited: event.target.value});
    }

    // user submit their votes.
    async submitVoteHandler() {
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        const sender = accounts[0];

        const weiBal = await window.web3.eth.getBalance(sender);
        const ethBal = window.web3.utils.fromWei(weiBal, "ether");

        const inputAmount = this.state.ethDeposited;
        const inputInWei = window.web3.utils.toWei(inputAmount.toString(), "ether");
        const voteIsValid = !(this.state.yaySelected && this.state.naySelected) && (this.state.yaySelected || this.state.naySelected);
        const votesYay = this.state.yaySelected && !this.state.naySelected;

        if (voteIsValid) {
            // verify input amount before initiating transaction.
            if (inputAmount == 0) {
                window.alert("Deposit amount can not be zero.");
            }
            else if (inputAmount > this.state.proposal.max_deposit) {
                window.alert("Deposit amount exceeded allowance.");
            }
            else if (inputAmount > parseFloat(ethBal)) {
                window.alert("Your balance is insufficient.");
            }
            else {
                // vote
                try {
                    await vote.methods.vote(this.state.proposal.id, votesYay).send({from: sender, value: inputInWei})
                    .on("transactionHash", (hash) => {
                        window.alert("Vote casted successfully.");
                        this.props.home();
                    })
                    .on("error", (error) => {
                        this.props.err();
                        console.error("Transaction failed (Preston)", error);
                    });
                } catch (error) {
                    this.props.err();
                    console.error("Rejection hurts (Preston)", error);
                }
            }
        }
        else {
            window.alert("Vote or die."); // South Park Reference.
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
            let voteContent;
            let propEndedContent = <div className = "content">  </div>;
            const propIsStillActive = this.state.proposal.end_block_number >= this.state.currentBlockNumber;

            // not voted
            if (this.state.voted === "0") {
                if (propIsStillActive) {
                    voteContent = 
                    <div className = "container" style = {{border: "groove blue", padding: "10px"}}>
                        <div className = "col text-center">
                            <p> Cast Your Vote: </p>
                            <div className = "row">
                                <div className = "col"> <label> <input type = "radio" value = "Yay" checked = {this.state.yaySelected} onChange = {this.voteHandler}/> YAY </label> </div>
                                <div className = "col"> <label> <input type = "radio" value = "Nay" checked = {this.state.naySelected} onChange = {this.voteHandler}/> NAY </label> </div>
                            </div>
                            <div className = "row">
                                <div className = "col"> Deposit Amount:  </div>
                                <div className = "col"> <input type = "number" value = {this.state.ethDeposited} onChange = {this.depositHandler}/> </div>
                                <div className = "col"> <button onClick = {this.submitVoteHandler}> VOTE ✔ </button> </div>
                            </div>
                        </div>
                    </div>
                }
                else {
                    voteContent = <p> You can no longer vote for this proposal. </p>
                }
            }
            // voted
            else if (this.state.voted === "1") {
                voteContent = <div> You voted: <p style = {{color: "green"}}> YAY </p> </div>
            }
            else if (this.state.voted === "2") {
                voteContent = <div> You voted: <p style = {{color: "red"}}> NAY </p> </div>
            }

            // proposal is no longer active.
            if (!propIsStillActive) {
                let consensus;
                if (this.state.proposal.yay_count > this.state.proposal.nay_count) {
                    consensus =
                    <h3> The proposal ended with the <p style = {{fontWeight: "bold", color: "green"}}> YAYs </p> as the majority. </h3>
                }
                else if (this.state.proposal.yay_count < this.state.proposal.nay_count) {
                    consensus =
                    <h3> The proposal ended with the <p style = {{fontWeight: "bold", color: "red"}}> NAYs </p> as the majority. </h3>
                }
                else {
                    consensus =
                    <h2> The proposal ended with a <p style = {{fontWeight: "bold", color: "yellow"}}> TIE </p>. </h2>
                }

                propEndedContent =
                <div className = "container">
                    {consensus}
                </div>
            }

            let yayPercent = (this.state.proposal.yay_count) * 100 / this.state.proposal.total_deposit;
            let nayPercent = (this.state.proposal.nay_count) * 100 / this.state.proposal.total_deposit;
            propBody = 
            <div className = "container"> 
                <p style = {{fontWeight: "bold"}}> Proposal ID #{this.state.proposal.id} </p>
                <div className = "col">
                    <div className = "row">
                        <div className = "col"> <h1> {this.state.proposal.title} </h1> </div> 
                    </div>
                    <div className = "row">
                       <div className = "col"> <label> Proposer:  </label> </div> 
                       <div className = "col"> <p> {this.state.proposal.proposer} </p></div> 
                    </div>
                    <div className = "row">
                       <div className = "col"> <label> Total ETH Staked:  </label> </div>
                       <div className = "col"> <p> {this.state.proposal.total_deposit} ETH </p> </div>   
                    </div>
                    <div className = "row">
                       <div className = "col"> <label> Maximum ETH Voting Allowance:  </label> </div>
                       <div className = "col"> <p> {this.state.proposal.max_deposit} ETH </p> </div>   
                    </div>
                    <div className = "row">
                       <div className = "col"> <label> Yay %:  </label> </div>
                       <div className = "col"> <p style = {{color: "green"}}> {yayPercent.toFixed(2)} % </p>  </div> 
                    </div>
                    <div className = "row">
                       <div className = "col"> <label> Nay %:  </label> </div>
                       <div className = "col"> <p style = {{color: "red"}}> {nayPercent.toFixed(2)} % </p>  </div> 
                    </div>
                    <div className = "row">
                       <div className = "col"> <label> Begin Block Number:  </label> </div>
                       <div className = "col"> <p> {this.state.proposal.begin_block_number} </p> </div>
                    </div>
                    <div className = "row">
                       <div className = "col"> <label> End Block Number:  </label> </div>
                       <div className = "col"> <p> {this.state.proposal.end_block_number} </p> </div>
                    </div>
                </div>
                {voteContent}
                {propEndedContent}
            </div>;
        }

        // page body component
        if (this.props.isAny) {
            body = 
            <div className = "container-fluid">
                <div className = "row">
                    <div className = "col"> 
                        <input placeholder = "Enter Proposal ID" type = "number" value = {this.state.input} onChange = {this.inputHandler}/>
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
                        <input placeholder = "Enter Index Number" type = "number" value = {this.state.input} onChange = {this.inputHandler}/>
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

    async componentDidUpdate(prevProps, prevState) {
        // input changed.
        let isOwner = !this.props.isAny;
        // // Potential bug
        // let voteChanged = (this.state.proposals.yay_count !== prevState.state.proposals.yay_count) || (this.state.proposals.nay_count !== prevState.state.proposals.nay_count)
        if ((prevState.input !== this.state.input && this.state.input !== "" && this.state.input !== "0")) {
            const proposal = await this.loadProposal(this.state.input, isOwner);
            const voted = await this.fetchVote(this.state.input);
            const blockNum = await window.web3.eth.getBlockNumber();
            this.setState({proposal: proposal});
            this.setState({voted: voted});
            this.setState({currentBlockNumber: blockNum});
        }
    }
}


// --- END OF HELPER FUNCTIONS ---

// load the components to root div in index.html
ReactDOM.render(
    <App/>,
    document.getElementById("root")
)