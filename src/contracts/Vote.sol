// Contract where users submit a proposal and cast votes, using staked ether.

pragma solidity ^0.5.0;

import "./lib/SafeMath.sol";

contract Vote {
    
    using SafeMath for uint256;
    address public admin;

    constructor() public {
        admin = msg.sender;
    }

    /**
     * This struct defines the Proposal object.
     * @param id - Unique identifier for the proposal.
     * @param proposer - The address created the proposal.
     * @param title - The description of the proposal.
     * @param yay_count - Count votes in proportion to their deposit eth amount for the proposal.
     * @param nay_count - Count votes in proportion to their deposit eth amount against the proposal.
     * @param deposit_balance - The total amount of ETH deposited for the proposal.
     * @param begin_block_number - The block number when the proposal is created.
     * @param end_block_number - The block number when the proposal becomes inactive.
     */
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        uint256 yay_count;
        uint256 nay_count;
        uint256 deposit_balance;
        uint256 begin_block_number;
        uint256 end_block_number;
    }

    enum Voter_Status {
        UNDECIDED,
        YAY,
        NAY
    }

    // Proposal Variables
    uint256 public total_proposals;
    mapping (uint256 => Proposal) public Proposals; // Find the proposals with the given ID.
    mapping (uint256 => uint256[]) public active_proposals; // block end number mapped to array of proposal ids.
    uint256[] public expiredId; // track expired proposals to claim eth.

    // Votes variables
    mapping (uint256 => mapping (address => Voter_Status)) internal addressToVote; // Show votes given by address and id.
    mapping (uint256 => Voter_Status) public winVotes; // Proposal majority votes.

    // Funds variables.
    mapping (uint256 => mapping (uint => mapping (address => uint256))) internal votingStake; // Show the amount of eth staked for the vote
    mapping (address => uint256) internal withdraw; // Keeping track of user withdrawable amount.

    event Transfer(address indexed _from, address indexed _to, uint256 amount); // Transfer of ETH event.
    event Voted(address indexed _voter, uint256 id, bool votesYay); // Users cast votes event.
    event EndOfProposal(uint256 id); // Proposal ended event trigger.

    /**
     * @dev Modifier to be called periodically to detect expired proposals.
     */
    modifier checkWinner() {
        // check if current block time coincides with proposal's end time.
        uint256 current = block.number;
        uint256[] memory endProposalIds = active_proposals[current];
        uint n = endProposalIds.length;
        for (uint i = 0; i < n; i++) {
            uint id = endProposalIds[i];
            Proposal memory prop = Proposals[id];
            if (prop.yay_count > prop.nay_count) {
                winVotes[id] = Voter_Status.YAY;
            }
            else {
                winVotes[id] = Voter_Status.NAY;
            }
            expiredId.push(id);
            emit EndOfProposal(id);
        }
        delete active_proposals[current];
        _;
    }

    /**
     * @dev Modifier to verify the withdrawer.
     */
    modifier isWithdrawer(address _withdraw) {
        require(msg.sender == _withdraw);
        _;
    }

    /** 
     * @dev Function to calculate earnings from winning proposals.
     * @return The amount of eth withdrawable by the winner.
     */
    function earnedEth(address _winner, uint256 id) internal {
        Proposal memory prop = Proposals[id];
        uint wonVote = uint(winVotes[id]);
        uint stake = votingStake[id][wonVote][_winner];
        uint earned;
        if (wonVote == 1) {
            uint total = prop.yay_count;
            uint percent = stake.mul(100).div(total);
            earned = prop.deposit_balance.mul(percent);
        } else if (wonVote == 2) {
            uint total = prop.nay_count;
            uint percent = stake.mul(100).div(total);
            earned = prop.deposit_balance.mul(percent);
        } else {
            uint total = prop.deposit_balance;
            uint percent = stake.mul(100).div(total);
            earned = prop.deposit_balance.mul(percent);
        }
        withdraw[_winner] = withdraw[_winner].add(earned);
        delete votingStake[id][wonVote][_winner];
    }

    /**
     * @dev Function to create a proposal, requires a minimum deposit amount of 0.001 ETH.
     * @return The proposal id
     */
    function create(string memory title, uint endOffset) public payable checkWinner() returns(uint256) {
        require(msg.value >= 0.001 ether, "Deposit does not meet the minimum requirement");
        require(endOffset > 0, "End block number undefined");

        uint id = total_proposals.add(1);
        total_proposals = id;
        uint endBlock = block.number.add(endOffset);
        Proposal memory newProposal = Proposal(id, msg.sender, title, msg.value, 0, msg.value, block.number, endBlock);
        Proposals[total_proposals] = newProposal;
        active_proposals[newProposal.end_block_number].push(id);

        // Proposer votes yay by default.
        addressToVote[id][msg.sender] = Voter_Status.YAY;
        votingStake[id][uint(Voter_Status.YAY)][msg.sender] = msg.value;

        emit Transfer(msg.sender, address(this), msg.value);
        emit Voted(msg.sender, id, true);

        return id;
    }

    /**
     * @dev Function to vote on a proposal.
     */
    function vote(uint256 id, bool votesYay) public payable checkWinner() returns(bool success) {
        require(id <= total_proposals, "Invalid proposal");
        require(addressToVote[id][msg.sender] == Voter_Status.UNDECIDED, "Can not vote twice");
        Proposal storage proposal = Proposals[id];
        require(proposal.end_block_number > block.number, "Proposal is no longer active");
        require(msg.value >= 0.001 ether, "Deposit does not meet the minimum requirement");
        uint maximum = votingStake[id][uint(Voter_Status.YAY)][proposal.proposer].mul(90).div(100); // voters can only deposit 90% of the proposer's amount at most -- prevention of whales.
        require(msg.value <= maximum, "Deposit exceeded the maximum amount");

        proposal.deposit_balance = proposal.deposit_balance.add(msg.value);

        if (votesYay) {
            addressToVote[id][msg.sender] = Voter_Status.YAY;
            votingStake[id][uint(Voter_Status.YAY)][msg.sender] = msg.value;
            proposal.yay_count = proposal.yay_count.add(msg.value);
        }
        else {
            addressToVote[id][msg.sender] = Voter_Status.NAY;
            votingStake[id][uint(Voter_Status.NAY)][msg.sender] = msg.value;
            proposal.nay_count = proposal.nay_count.add(msg.value);
        }

        emit Transfer(msg.sender, address(this), msg.value);
        emit Voted(msg.sender, id, votesYay);

        return true;
    }

    /**
     * @dev User-callable function to find out their withdrawable amount.
     */
    function get_withdraw(address _withdrawer) public view isWithdrawer(_withdrawer) returns(uint256) {
        return withdraw[_withdrawer];
    }

    /**
     * @dev User-callable function to update their withdrawable earnings.
     */
    function updateEthEarned(address _voter) public isWithdrawer(_voter) checkWinner() returns(uint256) {
        for (uint i = 0; i < expiredId.length; i++) {
            earnedEth(_voter, i);
        }
        return get_withdraw(_voter);
    }

    /**
     * @dev Function for users to withdraw all of their eth.
     */
    function withdrawEth(address payable _withdrawer) public payable isWithdrawer(_withdrawer) returns(bool success) {
        uint withdrawBal = updateEthEarned(_withdrawer);
        require(withdrawBal > 0, "No funds available to withdraw");

        _withdrawer.transfer(withdrawBal);
        delete withdraw[_withdrawer];

        emit Transfer(address(this), _withdrawer, withdrawBal);

        return true;
    }

}