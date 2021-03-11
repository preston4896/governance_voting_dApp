// Contract where users submit a proposal and cast votes, using staked ether.

pragma solidity ^0.5.0;

import "./lib/SafeMath.sol";

contract Vote {
    
    using SafeMath for uint256;
    address public admin; // contract admin
    uint256 public balance; // contract eth balance

    constructor() public {
        admin = msg.sender;
    }

    /**
     * This struct defines the Proposal object.
     * @param id - Unique tracker for the proposal.
     * @param proposer - The address created the proposal.
     * @param title - The description of the proposal.
     * @param yay_count - Counting the number of votes in favor for the proposal.
     * @param nay_count - Counting the number of votes against the proposal.
     * @param deposit_balance - The total amount of ETH deposited for the proposal.
     * @param proposer_stake - The maximum amount of ETH set by the proposer that can be deposited by all voters, to prevent whales from manipulating vote results.
     */
    struct Proposal {
        uint256 id;
        address proposer;
        string title;
        uint256 yay_count;
        uint256 nay_count;
        uint256 deposit_balance;
        uint256 proposer_stake;
        uint256 begin_block_number;
        uint256 end_block_number;
    }

    enum Voter_Status {
        UNDECIDED,
        YAY,
        NAY
    }

    uint256 public total_proposals;
    mapping (uint256 => Proposal) public Proposals; // Find the proposals with the given ID.
    mapping (address => mapping (uint256 => Voter_Status)) private voteTracker; // Keeps track of votes by address and proposal id.

    event Transfer(address _from, address _to, uint256 amount);

    /**
     * @dev Function to create a proposal, requires a minimum deposit amount of 0.001 ETH.
     * @return The proposal id
     */
    function create(address payable _proposer, string memory title, uint endOffset) public payable returns(uint256) {
        require(msg.value >= 0.001 ether, "Deposit does not meet the minimum requirement.");
        require(endOffset > 0, "End block number undefined.");

        uint id = total_proposals.add(1);
        total_proposals = id;
        uint endBlock = block.number.add(endOffset);
        Proposal memory newProposal = Proposal(id, _proposer, title, 1, 0, msg.value, msg.value, block.number, endBlock);
        Proposals[total_proposals] = newProposal;
        voteTracker[_proposer][id] = Voter_Status.YAY; // Proposer votes yay by default.

        balance = balance.add(msg.value);

        emit Transfer(_proposer, address(this), msg.value);

        return id;
    }
}