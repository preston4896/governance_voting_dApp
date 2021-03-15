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
        } else {
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
    this.setState({ contractDeployed: false });

    const web3 = window.web3;
    const accounts = await web3.eth.getAccounts();

    this.setState({ account: accounts[0] });

    let balanceInWei = await web3.eth.getBalance(this.state.account);
    let balance = web3.utils.fromWei(balanceInWei, "ether");
    this.setState({ accountBalance: balance });

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

    // load user and app info from the contract. - getter functions should not cost any gas.

    // block number
    const vote = this.state.voteContract;
    let blockNumber = await vote.methods.lastBlockNumber().call();
    this.setState({ lastSyncedBlock: blockNumber });

    this.setState({ loading: false }); // App finished loading.
};

class App extends React.Component {

    // TODO
    /**
     * Gets the last block number prossessed by the contract, user staked and withdrawable.
     */
    async reloadHome() {
        const vote = this.state.voteContract;
        let blockNum = await vote.methods.lastBlockNumber().call();
        this.setState({ lastSyncedBlock: blockNum });
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
        };loadWeb3 = loadWeb3.bind(this);
        loadData = loadData.bind(this);
        this.reloadHome = this.reloadHome.bind(this);
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
                    React.createElement(AppBody, { contract: this.state.voteContract, refresh: this.reloadHome })
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
        await loadWeb3();
        await loadData();
        // listen for network change
        await window.ethereum.on('chainChanged', () => {
            this.setState({ loading: true });
            loadData();
        });

        // listen for account change
        await window.ethereum.on('accountsChanged', () => {
            this.setState({ loading: true });
            loadData();
        });
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
        super(props);
        this.state = {
            // App Stats
            componentState: "home",
            loading: false,
            transactionFailed: false,

            // Proposal Stats
            anyProp: true, // true if the user is looking for their own proposals.
            propCount: 0,

            // Network
            currentBlockNumber: 0

            // Binding functions
        };this.propHandler = this.propHandler.bind(this);
        this.propOwnHandler = this.propOwnHandler.bind(this);
        this.backHandler = this.backHandler.bind(this);
        this.createHandler = this.createHandler.bind(this);
        // this.submitHandler = this.submitHandler.bind(this);
    }

    // prop button handler
    async propHandler() {
        this.setState({ loading: true });
        let count = await this.loadPropCount(false);
        this.setState({ propCount: count });
        this.setState({ componentState: "prop" });
        this.setState({ anyProp: true });
        this.setState({ loading: false });
        await this.props.refresh();
    }
    async propOwnHandler() {
        this.setState({ loading: true });
        let count = await this.loadPropCount(true);
        this.setState({ propCount: count });
        this.setState({ componentState: "prop" });
        this.setState({ anyProp: false });
        this.setState({ loading: false });
        await this.props.refresh();
    }

    // create button handler
    async createHandler() {
        this.setState({ loading: true });
        this.setState({ componentState: "create" });
        this.setState({ loading: false });
        await this.props.refresh();
    }

    // back button handler
    async backHandler() {
        this.setState({ transactionFailed: false });
        this.setState({ componentState: "home" });
        await this.props.refresh();
    }

    // async submitHandler() {

    // }

    render() {
        let content;
        if (this.state.loading) {
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
                                { title: "Update Your Total Withdrawable ETH Amount." },
                                " Update ETH "
                            ),
                            " "
                        ),
                        React.createElement(
                            "div",
                            { className: "row-sm-12 rol-md-6 rol-lg-2" },
                            " ",
                            React.createElement(
                                "button",
                                { title: "Withdraw all ETH to your wallet. Make sure to update withdrawable ETH first." },
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
                                " You have created ",
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
                                "form",
                                null,
                                React.createElement(
                                    "div",
                                    { className: "row" },
                                    React.createElement(
                                        "label",
                                        null,
                                        "Title:",
                                        React.createElement("input", { type: "text", style: { margin: "3px" }, required: true })
                                    )
                                ),
                                React.createElement(
                                    "div",
                                    { className: "row" },
                                    React.createElement(
                                        "label",
                                        null,
                                        "End Block Number Offset:",
                                        React.createElement("input", { type: "text", style: { margin: "3px" }, required: true })
                                    )
                                ),
                                React.createElement(
                                    "button",
                                    null,
                                    " Submit "
                                )
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

// TODO
class ViewPropComponent extends React.Component {

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
        let res = {
            id: resItem[0],
            proposer: resItem[1],
            title: resItem[2],
            yay_count: resItem[3],
            nay_count: resItem[4],
            total_deposit: resItem[5],
            begin_block_number: resItem[6],
            end_block_number: resItem[7]
        };
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
        };
    }

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
            propBody = React.createElement("div", { className: "container" });
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
                        React.createElement("input", { placeholder: "Enter Proposal ID" }),
                        React.createElement(
                            "button",
                            null,
                            " Search "
                        )
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
                        React.createElement("input", { placeholder: "Enter Proposal ID" }),
                        React.createElement(
                            "button",
                            null,
                            " Search "
                        )
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
}

// --- END OF HELPER FUNCTIONS ---

// load the components to root div in index.html
ReactDOM.render(React.createElement(App, null), document.getElementById("root"));

