const Vote = artifacts.require("Vote");

contract("Vote", (accounts) => {
    // contract instance
    let vote;

    // account balances.
    let acc_0_bal;
    let acc_1_bal;

    // load the contract instance.
    before(async() => {
        vote = await Vote.deployed();
    })

    it("1. Create Proposals", async() => {
        let title = "Hello, World!";
        let offset = 20; // 20 blocks
        let deposit_amount = web3.utils.toWei("0.08");

        // initialize account balance.
        acc_0_bal = await web3.eth.getBalance(accounts[0]);
        acc_1_bal = await web3.eth.getBalance(accounts[1]);

        // attempts to stake more eth than balance.
        try {
            await vote.create(title, offset, {value: web3.utils.toWei("200")});
        } catch (error) {
            assert(error.message.indexOf("sender") >= 0, "sender error message.");
        }

        // // attempts to stake lower than the minimum requirement.
        try {
            await vote.create(title, offset, {value: web3.utils.toWei("0.00002")});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // invalid endblockTime
        try {
            await vote.create(title, 0, {value: deposit_amount});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // proposal successfully created.
        await vote.create(title, offset, {value: deposit_amount});

        // there should be one proposal.
        let total_proposals = await vote.total_proposals();
        assert.equal(total_proposals, 1, "1 proposal only.");

        // creates another proposal
        await vote.create(title, 2, {from: accounts[1], value: deposit_amount});

        // there should be two proposals.
        total_proposals = await vote.total_proposals();
        assert.equal(total_proposals, 2, "2 proposals only.");

        // // debug
        // let prop_2 = await vote.Proposals(2);
        // console.log(prop_2);
    })

    it("2. Cast Votes", async() => {
        let vote_amount = web3.utils.toWei("0.02");

        // voter attempts to vote on non-existent proposal
        try {
            await vote.vote(3, false, {value: vote_amount});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // proposer attempts to vote (multiple votes)
        try {
            await vote.vote(1, false, {value: vote_amount});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // attempts to vote on expired proposal
        try {
            await vote.vote(2, false, {value: vote_amount});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // attempts to deposit more eth than proposer.
        try {
            await vote.vote(1, false, {from: accounts[1], value: web3.utils.toWei("1")});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // accounts 1 voted yay, while accounts 2 voted nay. -- prop 1
        await vote.vote(1, true, {from: accounts[1], value: vote_amount});
        await vote.vote(1, false, {from: accounts[2], value: vote_amount});

        // verify deposited eth balance.
        let prop_1 = await vote.Proposals(1);
        let yay = prop_1.yay_count;
        let nay = prop_1.nay_count;
        let total = prop_1.deposit_balance;

        assert.equal(total, web3.utils.toWei("0.12"));
        assert.equal(yay, web3.utils.toWei("0.1"));
        assert.equal(nay, vote_amount);
    })

    it("3. Test Withdrawal.", async() => {
        // Prop 2 from test case 1 should be expired at this point, since it only has a lifespan of 2 block numbers.
        // verify prop 2's active status
        let prop_2 = await vote.inactiveIds(0);
        assert.equal(prop_2, 2, "Prop 2 should be inactive.")

        // accounts 1 attempts to withdraw.
        
        // update withdrawable funds
        await vote.updateEthEarned({from: accounts[1]});

        let bal = await vote.get_withdraw({from: accounts[1]});

        // accounts 1 should have most of its initial balance back, minus staked vote on prop 1.
        // let max = web3.utils.toWei("0.12")
    })
})