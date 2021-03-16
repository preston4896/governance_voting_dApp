const Vote = artifacts.require("Vote");

function token(x) {
    return web3.utils.toWei(x, "ether");
}

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
        let offset = 10; // 10 blocks
        let deposit_amount = token("0.08");

        // initialize account balance.
        acc_0_bal = await web3.eth.getBalance(accounts[0]);
        acc_1_bal = await web3.eth.getBalance(accounts[1]);

        // attempts to stake more eth than balance.
        try {
            await vote.create(title, offset, {value: token("200")});
        } catch (error) {
            assert(error.message.indexOf("sender") >= 0, "sender error message.");
        }

        // // attempts to stake lower than the minimum requirement.
        try {
            await vote.create(title, offset, {value: token("0.00002")});
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

        // test get staked.
        let expected_staked = deposit_amount;
        let actual_staked = await vote.get_staked();
        assert.equal(actual_staked, expected_staked);

        // creates another proposal
        await vote.create(title, 2, {from: accounts[1], value: deposit_amount});

        // there should be two proposals.
        total_proposals = await vote.total_proposals();
        assert.equal(total_proposals, 2, "2 proposals only.");
    })

    it("2. Cast Votes", async() => {
        let vote_amount = token("0.05");

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
            await vote.vote(1, false, {from: accounts[1], value: token("1")});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // accounts 1 and accounts 2 voted nay against proposer. -- prop 1
        await vote.vote(1, false, {from: accounts[1], value: vote_amount});
        await vote.vote(1, false, {from: accounts[2], value: vote_amount});

        // verify deposited eth balance.
        let prop_1 = await vote.Proposals(1);
        let yay = prop_1.yay_count;
        let nay = prop_1.nay_count;
        let total = prop_1.deposit_balance;

        assert.equal(total, token("0.18"));
        assert.equal(yay, token("0.08"));
        assert.equal(nay, token("0.1"));
    })

    it("3. Test Withdrawal.", async() => {
         // accounts 1 should have most of its initial balance back, minus staked vote on prop 1.
        await vote.updateEthEarned({from: accounts[1]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        let bal = await web3.eth.getBalance(accounts[1]);
        let amount = await vote.get_withdraw({from: accounts[1]});
        let max = acc_1_bal - token("0.05");
        assert.isAtMost(parseInt(bal) + parseInt(amount), max);

        await vote.updateEthEarned({from: accounts[3]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        // attempts withdraw with zero funds.
        try {
            await vote.withdrawEth({from: accounts[3]});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // --- END OF PROP 1, Nay Voters are the winners. ---

        // accounts[0] attempts to withdraw
        await vote.updateEthEarned({from: accounts[0]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        try {
            await vote.withdrawEth({from: accounts[3]});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // accounts[1] and accounts[2] withdraw.
        await vote.updateEthEarned({from: accounts[1]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        await vote.updateEthEarned({from: accounts[2]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.

        let expected_amount_1 = token("0.17"); // prop_1 + prop_2 withdrawals.
        let expected_amount_2 = token("0.09"); // prop_1 withdrawals.
        let acc1_actual = await vote.get_withdraw({from: accounts[1]});
        let acc2_actual = await vote.get_withdraw({from: accounts[2]});
        assert.equal(acc1_actual.toString(), expected_amount_1.toString());
        assert.equal(acc2_actual.toString(), expected_amount_2.toString());

        await vote.withdrawEth({from: accounts[1]});
        await vote.withdrawEth({from: accounts[2]});

        // there should not be any withdrawable eth left.
        await vote.updateEthEarned({from: accounts[1]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        acc1_actual = await vote.get_withdraw({from: accounts[1]});
        assert.equal(acc1_actual.toString(), "0");

        // contract has zero balance.
        let con = await web3.eth.getBalance(vote.address);
        assert.equal(con, 0);
    })

    it("4. Test Proposal That Ends With a Tie", async() => {
        let title = "This Proposal Ends With A Tie.";
        let offset = 3; // 3 blocks
        let deposit_amount = token("0.05");

        await vote.create(title, offset, {value: deposit_amount});

        // Both accounts[1] and [2] vote against the proposal that results in a tie.
        let vote_amount = token("0.025");
        await vote.vote(3, false, {from: accounts[1], value: vote_amount});
        await vote.vote(3, false, {from: accounts[2], value: vote_amount});

        // verify withdrawables
        await vote.updateEthEarned({from: accounts[0]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        await vote.updateEthEarned({from: accounts[1]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        await vote.updateEthEarned({from: accounts[2]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.

        // ending with a tie, everyone should be getting their ETH back.
        let expected_amount_0 = deposit_amount;
        let expected_amount_1 = vote_amount;
        let expected_amount_2 = vote_amount;
        let acc0_actual = await vote.get_withdraw({from: accounts[0]});
        let acc1_actual = await vote.get_withdraw({from: accounts[1]});
        let acc2_actual = await vote.get_withdraw({from: accounts[2]});
        assert.equal(acc0_actual.toString(), expected_amount_0.toString());
        assert.equal(acc1_actual.toString(), expected_amount_1.toString());
        assert.equal(acc2_actual.toString(), expected_amount_2.toString());

        await vote.withdrawEth({from: accounts[0]});
        await vote.withdrawEth({from: accounts[1]});
        await vote.withdrawEth({from: accounts[2]});

        // contract has zero balance.
        let con = await web3.eth.getBalance(vote.address);
        assert.equal(con, 0);
    })

    it("5. Two Proposals End At The Same Block.", async() => {
        let deposit_amount = token("0.3");
        let title = "The Twins";
        let offset1 = 6;
        let offset2 = 3;

        let vote_amount = token("0.2");

        await vote.create(title, offset1, {value: deposit_amount});
        await vote.vote(4, true, {from: accounts[1], value: vote_amount});
        await vote.vote(4, false, {from: accounts[2], value: vote_amount});

        await vote.create(title, offset2, {value: deposit_amount});
        await vote.vote(5, false, {from: accounts[1], value: vote_amount});
        await vote.vote(5, true, {from: accounts[2], value: vote_amount});

        // verify withdrawables
        await vote.updateEthEarned({from: accounts[0]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        await vote.updateEthEarned({from: accounts[1]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.
        await vote.updateEthEarned({from: accounts[2]}); // NOTE: Make sure to update withdrawable eth on the front end first, before the withdrawal.

        // ending with a tie, everyone should be getting their ETH back.
        let expected_amount_0 = token("0.84");
        let expected_amount_1 = token("0.28");
        let expected_amount_2 = token("0.28");
        let acc0_actual = await vote.get_withdraw({from: accounts[0]});
        let acc1_actual = await vote.get_withdraw({from: accounts[1]});
        let acc2_actual = await vote.get_withdraw({from: accounts[2]});
        assert.equal(acc0_actual.toString(), expected_amount_0.toString());
        assert.equal(acc1_actual.toString(), expected_amount_1.toString());
        assert.equal(acc2_actual.toString(), expected_amount_2.toString());

        await vote.withdrawEth({from: accounts[0]});
        await vote.withdrawEth({from: accounts[1]});
        await vote.withdrawEth({from: accounts[2]});

        // contract has zero balance.
        let con = await web3.eth.getBalance(vote.address);
        assert.equal(con, 0);
    })
})