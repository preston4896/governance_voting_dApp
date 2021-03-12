// Contract where users submit a proposal and cast votes, using staked ether.

pragma solidity ^0.5.0;

import "./lib/SafeMath.sol";

contract Vote {
    
    using SafeMath for uint256;
    address public admin; // contract admin

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

    uint256 public total_proposals;
    mapping (uint256 => Proposal) public Proposals; // Find the proposals with the given ID.
    mapping (uint256 => mapping (address => Voter_Status)) private addressToVote; // Show votes given by address and id.
    mapping (uint256 => mapping (uint => address[])) private voteToAddress; // Show the addresses correspond to a vote, requires id input.

    // Keeping track of active proposals.
    mapping (uint256 => uint256[]) private active_proposals; // block end number mapped to array of proposal ids.

    // Keeping track of user deposited amount
    mapping (uint256 => mapping(address => uint256)) private deposit;

    event Transfer(address indexed _from, address indexed _to, uint256 amount); // Transfer of ETH event.
    event Voted(address indexed _voter, uint256 id, bool votesYay); // Users cast votes event.

    /**
     * @dev Function to create a proposal, requires a minimum deposit amount of 0.001 ETH.
     * @return The proposal id
     */
    function create(string memory title, uint endOffset) public payable returns(uint256) {
        require(msg.value >= 0.001 ether, "Deposit does not meet the minimum requirement");
        require(endOffset > 0, "End block number undefined");

        uint id = total_proposals.add(1);
        total_proposals = id;
        uint endBlock = block.number.add(endOffset);
        Proposal memory newProposal = Proposal(id, msg.sender, title, msg.value, 0, msg.value, block.number, endBlock);
        Proposals[total_proposals] = newProposal;
        active_proposals[newProposal.end_block_number].push(id);

        deposit[id][msg.sender] = msg.value;

        // Proposer votes yay by default.
        addressToVote[id][msg.sender] = Voter_Status.YAY;
        voteToAddress[id][uint(Voter_Status.YAY)].push(msg.sender);

        emit Transfer(msg.sender, address(this), msg.value);

        return id;
    }

    /**
     * @dev Function to vote on a proposal.
     */
    function vote(uint256 id, bool votesYay) public payable returns(bool success) {
        require(id <= total_proposals, "Invalid proposal");
        require(addressToVote[id][msg.sender] == Voter_Status.UNDECIDED, "Can not vote twice");
        Proposal storage proposal = Proposals[id];
        require(proposal.end_block_number > block.number, "Proposal is no longer active");
        require(msg.value >= 0.001 ether, "Deposit does not meet the minimum requirement");
        uint maximum = deposit[id][proposal.proposer].mul(90).div(100); // voters can only deposit 90% of the proposer's amount at most -- prevention of whales.
        require(msg.value <= maximum, "Deposit exceeded the maximum amount");

        proposal.deposit_balance = proposal.deposit_balance.add(msg.value);
        deposit[id][msg.sender] = msg.value;

        if (votesYay) {
            addressToVote[id][msg.sender] = Voter_Status.YAY;
            voteToAddress[id][uint(Voter_Status.YAY)].push(msg.sender);
            proposal.yay_count = proposal.yay_count.add(msg.value);
        }
        else {
            addressToVote[id][msg.sender] = Voter_Status.NAY;
            voteToAddress[id][uint(Voter_Status.NAY)].push(msg.sender);
            proposal.nay_count = proposal.nay_count.add(msg.value);
        }

        emit Voted(msg.sender, id, votesYay);

        return true;
    }

}