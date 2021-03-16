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
            } else {
                let message = "Browser does not support Web3. Consider installing MetaMask.";
                let alert = confirm(message);
                if (alert) {
                    window.open("https://metamask.io/", "_blank", "noopener, noreferrer");
                }
            }
    }

    /**
     * load the contract
     */
    async loadContract() {
        this.setState({ loading: true });
        this.setState({ contractDeployed: false });

        const web3 = window.web3;

        const networkId = await web3.eth.net.getId();
        this.setState({ network: networkId });

        // load the contract
        let abi;
        let address;
        await fetch("./src/builds/Vote.json").then(body => body.json()).then(data => {
            abi = data.abi;
            address = data.networks[networkId].address;
            const vote = new web3.eth.Contract(abi, address);
            this.setState({ voteContract: vote });
            this.setState({ contractDeployed: true });
        }).catch(error => {
            window.alert("The contract is not deployed to this network.");
        });

        await this.loadData();

        this.setState({ loading: false }); // App finished loading.
    }

    /**
     * Gets the last block number prossessed by the contract, account info, user staked and withdrawable.
     */
    async loadData() {
        const vote = this.state.voteContract;
        const web3 = window.web3;

        // block number
        let blockNum = await vote.methods.lastBlockNumber().call();
        this.setState({ lastSyncedBlock: blockNum });

        // account info
        const accounts = await web3.eth.getAccounts();
        this.setState({ account: accounts[0] });
        let balanceInWei = await web3.eth.getBalance(this.state.account);
        let balance = web3.utils.fromWei(balanceInWei, "ether");
        this.setState({ accountBalance: balance });

        // deposit info
        const stakedInWei = await vote.methods.get_staked().call({ from: this.state.account });
        const staked = web3.utils.fromWei(stakedInWei, "ether");
        this.setState({ amountDeposited: staked });

        // withdraw info
        const withdrawableInWei = await vote.methods.get_withdraw().call({ from: this.state.account });
        const withdrawable = web3.utils.fromWei(withdrawableInWei, "ether");
        this.setState({ amountWithdrawable: withdrawable });
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


            // bind fucntions
        };this.loadWeb3 = this.loadWeb3.bind(this);
        this.loadContract = this.loadContract.bind(this);
        this.loadData = this.loadData.bind(this);
    }

    render() {
        let welcomeMessage;
        let info;
        let footer = React.createElement(
            "p",
            null,
            " \xA9 2021 Copyrights Reserved by Preston Ong "
        );
        if (this.state.loading) {
            welcomeMessage = React.createElement(
                "p",
                null,
                " Loading... "
            );
        } else {
            if (this.state.contractDeployed) {
                info = React.createElement(
                    "div",
                    null,
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                null,
                                " Total staked: ",
                                this.state.amountDeposited,
                                " ETH "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                null,
                                " Withdrawable amount: ",
                                this.state.amountWithdrawable,
                                " ETH "
                            ),
                            "  "
                        )
                    ),
                    React.createElement(
                        "p",
                        null,
                        " A minimum of 0.001 ETH is required to create a new proposal. "
                    ),
                    React.createElement(AppBody, { contract: this.state.voteContract, refresh: this.loadData })
                );
                footer = React.createElement(
                    "footer",
                    null,
                    React.createElement(
                        "div",
                        { className: "container" },
                        React.createElement(
                            "div",
                            { className: "row" },
                            React.createElement(
                                "div",
                                { className: "col" },
                                " ",
                                React.createElement(
                                    "p",
                                    null,
                                    " Last Synced Block Number: ",
                                    this.state.lastSyncedBlock,
                                    " "
                                ),
                                " "
                            )
                        )
                    )
                );
            }
            welcomeMessage = React.createElement(
                "div",
                { className: "container" },
                React.createElement(
                    "h2",
                    null,
                    " Welcome, ",
                    this.state.account,
                    "! "
                ),
                React.createElement(
                    "h3",
                    null,
                    " Your current balance is ",
                    this.state.accountBalance,
                    " ETH "
                )
            );
        }

        return React.createElement(
            "div",
            { className: "container text-center text-break" },
            React.createElement(
                "h1",
                null,
                " Preston's Voting dApp "
            ),
            welcomeMessage,
            info,
            footer
        );
    }

    async componentDidMount() {
        await this.loadWeb3();
        await this.loadContract();
        // listen for network change
        await window.ethereum.on('chainChanged', () => {
            this.loadContract();
        });

        // listen for account change
        await window.ethereum.on('accountsChanged', () => {
            this.loadData();
        });
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
        } else {
            res = await vote.methods.total_proposals().call();
        }
        return res;
    }

    /**
     * Loads the current block number.
     */
    async getCurrentBlockNumber() {
        const blockNum = await window.web3.eth.getBlockNumber();
        this.setState({ currentBlockNumber: blockNum });
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

            // Binding functions
        };this.propHandler = this.propHandler.bind(this);
        this.propOwnHandler = this.propOwnHandler.bind(this);
        this.backHandler = this.backHandler.bind(this);
        this.createHandler = this.createHandler.bind(this);
        this.titleHandler = this.titleHandler.bind(this);
        this.offsetHandler = this.offsetHandler.bind(this);
        this.depositHandler = this.depositHandler.bind(this);
        this.submitHandler = this.submitHandler.bind(this);
        this.redeemHandler = this.redeemHandler.bind(this);
        this.withdrawHandler = this.withdrawHandler.bind(this);
    }

    // prop button handler
    async propHandler() {
        this.setState({ bodyLoading: true });
        let count = await this.loadPropCount(false);
        this.setState({ propCount: count });
        this.setState({ componentState: "prop" });
        this.setState({ anyProp: true });
        this.setState({ bodyLoading: false });
        await this.props.refresh();
    }
    async propOwnHandler() {
        this.setState({ bodyLoading: true });
        let count = await this.loadPropCount(true);
        this.setState({ propCount: count });
        this.setState({ componentState: "prop" });
        this.setState({ anyProp: false });
        this.setState({ bodyLoading: false });
        await this.props.refresh();
    }

    // create button handler
    async createHandler() {
        this.setState({ bodyLoading: true });
        this.setState({ componentState: "create" });
        this.setState({ bodyLoading: false });
        await this.props.refresh();
    }

    // back button handler
    async backHandler() {
        this.setState({ transactionFailed: false });
        this.setState({ componentState: "home" });
        await this.props.refresh();
    }

    // update proposal title
    titleHandler(event) {
        this.setState({ newTitle: event.target.value });
    }

    // update offset
    offsetHandler(event) {
        this.setState({ newOffset: event.target.value });
    }

    // deposit handler
    depositHandler(event) {
        this.setState({ amount: event.target.value });
    }

    // submit then initiate transaction.
    async submitHandler() {
        const inputsAreValid = this.state.newTitle !== "" && this.state.newOffset !== "" && parseFloat(this.state.amount) >= 0.001;
        if (inputsAreValid) {
            this.setState({ bodyLoading: true });

            const accounts = await window.web3.eth.getAccounts();
            const sender = accounts[0];
            const vote = this.props.contract;

            const weiAmount = web3.utils.toWei(this.state.amount.toString(), "ether");
            const estimateGasLimit = await vote.methods.create(this.state.newTitle, this.state.newOffset).estimateGas({ from: sender, value: weiAmount });

            // submit proposal
            try {
                await vote.methods.create(this.state.newTitle, this.state.newOffset).send({ from: sender, value: weiAmount, gas: estimateGasLimit }).on("transactionHash", hash => {
                    this.setState({ newTitle: "" });
                    this.setState({ newOffset: "" });
                    this.setState({ amount: "0.001" });
                    this.setState({ componentState: "home" });
                    this.props.refresh();
                    window.alert("Your Proposal Has Been Successfully Created.");
                }).on("error", error => {
                    this.setState({ transactionFailed: true });
                    console.error("Transaction failed (Preston)", error);
                });
            } catch (error) {
                this.setState({ transactionFailed: true });
                console.error("Rejection hurts (Preston)", error);
            }
            this.setState({ bodyLoading: false });
        }
    }

    // Redeem ETH
    async redeemHandler() {
        this.setState({ bodyLoading: true });
        const count = await this.loadPropCount(true);
        let message = "You have not created or voted on any proposals yet. It is unlikely that you would have accrued any redeemable ETH. Proceeding this option will incur a transaction (gas) fee. Continue?";
        let confirm;
        if (count == 0) {
            confirm = window.confirm(message);
        }
        if (confirm === false) {
            this.setState({ bodyLoading: false });
            this.setState({ componentState: "home" });
        }
        if (count > 0 || confirm) {
            const vote = this.props.contract;

            const accounts = await window.web3.eth.getAccounts();
            const sender = accounts[0];

            const estimateGasLimit = await vote.methods.updateEthEarned().estimateGas({ from: sender });

            // updating withdrawable
            try {
                await vote.methods.updateEthEarned().send({ from: sender, gas: estimateGasLimit }).on("transactionHash", hash => {
                    window.alert("Your transaction has been confirmed.");
                }).on("error", error => {
                    this.setState({ transactionFailed: true });
                    console.error("Transaction failed (Preston)", error);
                });
            } catch (error) {
                this.setState({ transactionFailed: true });
                console.error("Rejection hurts (Preston)", error);
            }
            this.setState({ bodyLoading: false });
            this.setState({ componentState: "home" });
            await this.props.refresh();
        }
    }

    // Withdraw ETH.
    async withdrawHandler() {
        this.setState({ bodyLoading: true });
        window.alert("Make sure that you clicked on Redeem ETH to claim all of your withdrawable ETH before withdrawing.");

        // load account info
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        const sender = accounts[0];

        // load balance
        const withdrawable = await vote.methods.get_withdraw().call({ from: sender });

        if (withdrawable == 0) {
            window.alert("You do not have any withdrawable ETH.");
        } else {
            const estimateGasLimit = await vote.methods.withdrawEth().estimateGas({ from: sender });
            // withdraw accounts.
            try {
                await vote.methods.withdrawEth().send({ from: sender, gas: estimateGasLimit }).on("transactionHash", hash => {
                    window.alert("Funds have been withdrawned.");
                }).on("error", error => {
                    this.setState({ transactionFailed: true });
                    console.error("Transaction failed (Preston)", error);
                });
            } catch (error) {
                this.setState({ transactionFailed: true });
                console.error("Rejection hurts (Preston)", error);
            }
        }

        this.setState({ bodyLoading: false });
        this.setState({ componentState: "home" });
        await this.props.refresh();
    }

    render() {
        let content;
        if (this.state.bodyLoading) {
            content = React.createElement(
                "p",
                null,
                " Loading... "
            );
        } else {
            if (this.state.transactionFailed) {
                content = React.createElement(
                    "div",
                    { className: "container" },
                    React.createElement(
                        "p",
                        null,
                        " Error: The transaction did not go through. Please try again. "
                    ),
                    React.createElement(BackButton, { handler: this.backHandler })
                );
            } else {
                if (this.state.componentState == "home") {
                    content = React.createElement(
                        "div",
                        { className: "row d-flex align-items-center justify-content-between" },
                        React.createElement(
                            "div",
                            { className: "row-sm-12 rol-md-6 rol-lg-2" },
                            " ",
                            React.createElement(
                                "button",
                                { title: "Locate A Proposal By Their IDs.", onClick: this.propHandler },
                                " Search or Vote On Proposal(s) "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "row-sm-12 rol-md-6 rol-lg-2" },
                            " ",
                            React.createElement(
                                "button",
                                { title: "View The Proposals That You Created.", onClick: this.propOwnHandler },
                                " Find My Proposals "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "row-sm-12 rol-md-6 rol-lg-2" },
                            " ",
                            React.createElement(
                                "button",
                                { title: "A minimum of 0.001 ETH is required.", onClick: this.createHandler },
                                " Create A Proposal and Stake ETH "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "row-sm-12 rol-md-6 rol-lg-2" },
                            " ",
                            React.createElement(
                                "button",
                                { title: "Redeem Your Total Withdrawable ETH Amount.", onClick: this.redeemHandler },
                                " Redeem ETH "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "row-sm-12 rol-md-6 rol-lg-2" },
                            " ",
                            React.createElement(
                                "button",
                                { title: "Withdraw all ETH to your wallet. Make sure to redeem withdrawable ETH first.", onClick: this.withdrawHandler },
                                " Withdraw ETH "
                            ),
                            " "
                        )
                    );
                } else if (this.state.componentState == "prop") {
                    // load the proposal here.
                    let prop_count;

                    if (this.state.anyProp) {
                        prop_count = React.createElement(
                            "div",
                            { className: "container" },
                            React.createElement(
                                "p",
                                null,
                                " Proposal Count: ",
                                this.state.propCount,
                                " "
                            )
                        );
                    } else {
                        prop_count = React.createElement(
                            "div",
                            { className: "container" },
                            React.createElement(
                                "p",
                                null,
                                " You have created or voted on ",
                                this.state.propCount,
                                " proposal(s) so far. "
                            )
                        );
                    }

                    content = React.createElement(
                        "div",
                        { className: "container" },
                        prop_count,
                        React.createElement(ViewPropComponent, { isAny: this.state.anyProp, contract: this.props.contract }),
                        React.createElement(BackButton, { handler: this.backHandler })
                    );
                } else if (this.state.componentState == "create") {
                    content = React.createElement(
                        "div",
                        { className: "container" },
                        React.createElement(
                            "div",
                            { className: "col", style: { margin: "10px", border: "dashed black" } },
                            React.createElement(
                                "p",
                                null,
                                " New Proposal "
                            ),
                            React.createElement(
                                "div",
                                { className: "row" },
                                React.createElement(
                                    "label",
                                    null,
                                    "Title:",
                                    React.createElement("input", { type: "text", style: { margin: "3px" }, value: this.state.newTitle, onChange: this.titleHandler })
                                )
                            ),
                            React.createElement(
                                "div",
                                { className: "row" },
                                React.createElement(
                                    "label",
                                    null,
                                    "End Block Number Offset:",
                                    React.createElement("input", { type: "number", min: "1", style: { margin: "3px" }, value: this.state.newOffset, onChange: this.offsetHandler })
                                )
                            ),
                            React.createElement(
                                "div",
                                { className: "row" },
                                React.createElement(
                                    "label",
                                    null,
                                    "Deposit Amount:",
                                    React.createElement("input", { type: "number", min: "0.001", style: { margin: "3px" }, value: this.state.amount, onChange: this.depositHandler })
                                )
                            ),
                            React.createElement(
                                "button",
                                { onClick: this.submitHandler },
                                " Submit "
                            )
                        ),
                        React.createElement(
                            "p",
                            null,
                            " Current Block Number: ",
                            this.state.currentBlockNumber,
                            " "
                        ),
                        React.createElement(
                            "p",
                            null,
                            " An average block time is approximately 10-20 seconds (Mainnet, Rinkeby and Goerli). An offset of 1 would mean that your proposal would only last for 20 seconds at most. "
                        ),
                        React.createElement(
                            "p",
                            { style: { fontStyle: "strong", color: "red" } },
                            " WARNING: You must deposit more than 0.001 ETH, otherwise the transaction will fail. "
                        ),
                        React.createElement(BackButton, { handler: this.backHandler })
                    );
                }
            }
        }

        return React.createElement(
            "div",
            { className: "container" },
            content
        );
    }

    // live-render block number
    async componentDidUpdate() {
        await this.getCurrentBlockNumber();
    }
}

// --- HELPER FUNCTIONS AND COMPONENTS ---

function BackButton(props) {
    return React.createElement(
        "button",
        { onClick: props.handler },
        " Back "
    );
}

class ViewPropComponent extends React.Component {

    /**
     * Load a proposal by the given query (ID or ownerIndex).
     * @param {Number} query - The proposalID or the index to query the owner's proposal.
     * @param {Boolean} callerIsVoter - True: query IDs; False: query indices.
     * @returns {Object} The Proposal Object. { uint256 id, address proposer, string title, uint256 yay_count, uint256 nay_count, uint256 total_deposit, uint256 begin_block_number, uint256 end_block_number }
     */
    async loadProposal(query, callerIsVoter) {
        const vote = this.props.contract;
        const accounts = await window.web3.eth.getAccounts();
        let resItem = new Array(8);
        if (callerIsVoter) {
            query--;
        }
        try {
            resItem = await vote.methods.get_proposals(query, callerIsVoter).call({ from: accounts[0] });
        } catch (error) {
            window.alert("Unable to load proposal.");
        }
        let res = {
            id: resItem[0],
            proposer: resItem[1],
            title: resItem[2],
            yay_count: window.web3.utils.fromWei(resItem[3].toString(), "ether"),
            nay_count: window.web3.utils.fromWei(resItem[4].toString(), "ether"),
            total_deposit: window.web3.utils.fromWei(resItem[5].toString(), "ether"),
            begin_block_number: resItem[6],
            end_block_number: resItem[7]
        };
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

        const callerVote = await vote.methods.get_votes(id).call({ from: sender });
        return callerVote;
    }

    /**
     * Initialize the Proposal Component
     * @param {object} props - props.contract: contract ABI, props.isAny: True, if user is looking for any proposal. False otherwise, user is looking for their own proposal.
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

            // binding functions
        };this.inputHandler = this.inputHandler.bind(this);
        this.voteHandler = this.voteHandler.bind(this);
    }

    // updates the input states to trigger didComponentUpdate() to reload proposal.
    async inputHandler(event) {
        if (event.target.value === "" || event.target.value === 0) {
            this.setState({ proposal: undefined });
        }
        this.setState({ input: event.target.value });
    }

    // Handles the user's votes.
    voteHandler(event) {
        if (event.target.value === "Yay" && event.target.checked) {
            this.setState({ yaySelected: true });
            this.setState({ naySelected: false });
        } else if (event.target.value === "Nay" && event.target.checked) {
            this.setState({ yaySelected: false });
            this.setState({ naySelected: true });
        }
    }

    async submitVoteHandler() {}

    render() {
        let body;
        let propBody;

        // proposalBody component
        if (!this.state.proposal) {
            propBody = React.createElement(
                "div",
                { className: "container" },
                React.createElement(
                    "p",
                    null,
                    " Waiting to fetch proposal... "
                )
            );
        } else {
            let voteContent;
            let propEndedContent = React.createElement(
                "div",
                { className: "content" },
                "  "
            );
            const propIsStillActive = this.state.proposal.end_block_number >= this.state.currentBlockNumber;

            // not voted
            if (this.state.voted === "0") {
                if (propIsStillActive) {
                    voteContent = React.createElement(
                        "div",
                        { className: "container" },
                        React.createElement(
                            "div",
                            { className: "col text-center" },
                            React.createElement(
                                "p",
                                null,
                                " Cast Your Vote: "
                            ),
                            React.createElement(
                                "div",
                                { className: "row" },
                                React.createElement(
                                    "div",
                                    { className: "col" },
                                    " ",
                                    React.createElement(
                                        "label",
                                        null,
                                        " ",
                                        React.createElement("input", { type: "radio", value: "Yay", checked: this.state.yaySelected, onChange: this.voteHandler }),
                                        " YAY "
                                    ),
                                    " "
                                ),
                                React.createElement(
                                    "div",
                                    { className: "col" },
                                    " ",
                                    React.createElement(
                                        "label",
                                        null,
                                        " ",
                                        React.createElement("input", { type: "radio", value: "Nay", checked: this.state.naySelected, onChange: this.voteHandler }),
                                        " NAY "
                                    ),
                                    " "
                                )
                            ),
                            React.createElement(
                                "div",
                                { className: "row" },
                                React.createElement(
                                    "div",
                                    { className: "col" },
                                    " Deposit Amount:  "
                                ),
                                React.createElement(
                                    "div",
                                    { className: "col" },
                                    " ",
                                    React.createElement("input", { type: "number", value: this.state.ethDeposited, onClick: this.submitVoteHandler }),
                                    " "
                                )
                            )
                        )
                    );
                } else {
                    voteContent = React.createElement(
                        "p",
                        null,
                        " You can no longer vote for this proposal. "
                    );
                }
            }
            // voted
            else if (this.state.voted === "1") {
                    voteContent = React.createElement(
                        "div",
                        null,
                        " You voted: ",
                        React.createElement(
                            "p",
                            { style: { color: "green" } },
                            " YAY "
                        ),
                        " "
                    );
                } else if (this.state.voted === "2") {
                    voteContent = React.createElement(
                        "div",
                        null,
                        " You voted: ",
                        React.createElement(
                            "p",
                            { style: { color: "red" } },
                            " NAY "
                        ),
                        " "
                    );
                }

            // proposal is no longer active.
            if (!propIsStillActive) {
                let consensus;
                if (this.state.proposal.yay_count > this.state.proposal.nay_count) {
                    consensus = React.createElement(
                        "h3",
                        null,
                        " The proposal ended with the ",
                        React.createElement(
                            "p",
                            { style: { fontWeight: "bold", color: "green" } },
                            " YAYs "
                        ),
                        " as the majority. "
                    );
                } else if (this.state.proposal.yay_count < this.state.proposal.nay_count) {
                    consensus = React.createElement(
                        "h3",
                        null,
                        " The proposal ended with the ",
                        React.createElement(
                            "p",
                            { style: { fontWeight: "bold", color: "red" } },
                            " NAYs "
                        ),
                        " as the majority. "
                    );
                } else {
                    consensus = React.createElement(
                        "h2",
                        null,
                        " The proposal ended with a ",
                        React.createElement(
                            "p",
                            { style: { fontWeight: "bold", color: "yellow" } },
                            " TIE "
                        ),
                        ". "
                    );
                }

                propEndedContent = React.createElement(
                    "div",
                    { className: "container" },
                    consensus
                );
            }

            let yayPercent = this.state.proposal.yay_count * 100 / this.state.proposal.total_deposit;
            let nayPercent = this.state.proposal.nay_count * 100 / this.state.proposal.total_deposit;
            propBody = React.createElement(
                "div",
                { className: "container" },
                React.createElement(
                    "p",
                    null,
                    " Proposal ID #",
                    this.state.proposal.id,
                    " "
                ),
                React.createElement(
                    "div",
                    { className: "col" },
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "h1",
                                null,
                                " ",
                                this.state.proposal.title,
                                " "
                            ),
                            " "
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "label",
                                null,
                                " Proposer:  "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                null,
                                " ",
                                this.state.proposal.proposer,
                                " "
                            )
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "label",
                                null,
                                " Total Deposit:  "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                null,
                                " ",
                                this.state.proposal.total_deposit,
                                " ETH "
                            ),
                            " "
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "label",
                                null,
                                " Yay %:  "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                { style: { color: "green" } },
                                " ",
                                yayPercent.toFixed(2),
                                " % "
                            ),
                            "  "
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "label",
                                null,
                                " Nay %:  "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                { style: { color: "red" } },
                                " ",
                                nayPercent.toFixed(2),
                                " % "
                            ),
                            "  "
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "label",
                                null,
                                " Begin Block Number:  "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                null,
                                " ",
                                this.state.proposal.begin_block_number,
                                " "
                            ),
                            " "
                        )
                    ),
                    React.createElement(
                        "div",
                        { className: "row" },
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "label",
                                null,
                                " End Block Number:  "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "col" },
                            " ",
                            React.createElement(
                                "p",
                                null,
                                " ",
                                this.state.proposal.end_block_number,
                                " "
                            ),
                            " "
                        )
                    )
                ),
                voteContent,
                propEndedContent
            );
        }

        // page body component
        if (this.props.isAny) {
            body = React.createElement(
                "div",
                { className: "container-fluid" },
                React.createElement(
                    "div",
                    { className: "row" },
                    React.createElement(
                        "div",
                        { className: "col" },
                        React.createElement("input", { placeholder: "Enter Proposal ID", type: "number", value: this.state.input, onChange: this.inputHandler })
                    )
                ),
                propBody
            );
        } else {
            body = React.createElement(
                "div",
                { className: "container-fluid" },
                React.createElement(
                    "div",
                    { className: "row" },
                    React.createElement(
                        "div",
                        { className: "col" },
                        React.createElement("input", { placeholder: "Enter Index Number", type: "number", value: this.state.input, onChange: this.inputHandler })
                    )
                ),
                propBody
            );
        }

        return React.createElement(
            "div",
            { className: "container", style: { border: "dotted black", margin: "10px" } },
            body
        );
    }

    async componentDidUpdate(prevProps, prevState) {
        // input changed.
        let isOwner = !this.props.isAny;
        if (prevState.input !== this.state.input && this.state.input !== "" && this.state.input !== "0") {
            const proposal = await this.loadProposal(this.state.input, isOwner);
            const voted = await this.fetchVote(this.state.input);
            const blockNum = await window.web3.eth.getBlockNumber();
            this.setState({ proposal: proposal });
            this.setState({ voted: voted });
            this.setState({ currentBlockNumber: blockNum });
        }
    }
}

// --- END OF HELPER FUNCTIONS ---

// load the components to root div in index.html
ReactDOM.render(React.createElement(App, null), document.getElementById("root"));

