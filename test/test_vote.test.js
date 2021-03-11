const Vote = artifacts.require("Vote");

contract("Vote", (accounts) => {
    // contract instance
    let vote;

    // load the contract instance.
    before(async() => {
        vote = await Vote.deployed();
    })

    it("1. Create Proposals", async() => {
        let title = "Hello, World!";
        let offset = 10; // 10 blocks
        let deposit_amount = web3.utils.toWei("0.08");

        // attempts to stake more eth than balance.
        try {
            await vote.create(accounts[0], title, offset, {value: web3.utils.toWei("200")});
        } catch (error) {
            assert(error.message.indexOf("sender") >= 0, "sender error message.");
        }

        // // attempts to stake lower than the minimum requirement.
        try {
            await vote.create(accounts[0], title, offset, {value: web3.utils.toWei("0.00002")});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // invalid endblockTime
        try {
            await vote.create(accounts[0], title, 0, {value: deposit_amount});
        } catch (error) {
            assert(error.message.indexOf("revert") >= 0, "error message must contain revert.");
        }

        // proposal successfully created.
        await vote.create(accounts[0], title, offset, {value: deposit_amount});

        // there should be one proposal.
        let total_proposals = await vote.total_proposals();
        assert.equal(total_proposals, 1, "1 proposal only.");

        // check contract balance.
        let expected_bal = await vote.balance();
        let actual_bal = await web3.eth.getBalance(vote.address);
        assert.equal(actual_bal, expected_bal, "balance should match.");
    })
})