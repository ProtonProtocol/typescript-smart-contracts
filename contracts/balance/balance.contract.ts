import { ExtendedAsset, unpackActionData, Name, check, action, notify, contract, requireAuth, SAME_PAYER, ExtendedSymbol } from 'as-chain'
import { TableStore } from '../store';
import { AllowContract } from '../allow';
import { transfer, atomicassets, withdraw, balance } from './balance.constants';
import { sendTransferTokens, sendTransferNfts, NftTransfer, TokenTransfer } from './balance.inline';
import { Account } from './balance.tables';
import { addNfts, addTokens, substractNfts, substractTokens } from './balance.utils';

@contract(balance)
export class BalanceContract extends AllowContract {
    accountsTable: TableStore<Account> = Account.getTable(this.receiver)

    /**
     * Incoming notification of "transfer" action from any contract
     * - If the contract is the atomicassets contract, then the action data is an NFT transfer.
     * - Else, the action data is a token transfer
     * @returns Nothing.
     */
    @action(transfer, notify)
    transfer(): void {
        // Pre-conditions
        this.checkContractIsNotPaused()

        if (this.parentContract == atomicassets) {
            // Unpack nft transfer
            let t = unpackActionData<NftTransfer>()

            // Skip if outgoing
            if (t.from == this.contract) {
                return;
            }
        
            // Validate transfer
            check(t.to == this.contract, "Invalid Deposit");
        
            // Add nfts
            this.addBalance(t.from, [], t.asset_ids, this.contract)
        } else {
            // Unpack token transfer
            let t = unpackActionData<TokenTransfer>()

            // Skip if outgoing
            if (t.from == this.contract) {
                return;
            }
  
            // Skip if deposit from system accounts
            if (
                t.from == Name.fromString("eosio.stake") ||
                t.from == Name.fromString("eosio.ram") ||
                t.from == Name.fromString("eosio")
            ) {
                return
            }
        
            // Validate transfer
            check(t.to == this.contract, "Invalid Deposit");

            // Add balance
            const tokens = [new ExtendedAsset(t.quantity, this.parentContract)]
            this.addBalance(t.from, tokens, [], this.contract)
        }
    }

    /**
     * Withdraw tokens and NFTs from an actor and transfer them to another actor
     * @param {Name} actor - Name
     * @param {ExtendedAsset[]} tokens - An array of `ExtendedAsset` objects.
     * @param {u64[]} nfts - u64[]
     */
    @action(withdraw)
    withdraw(
        actor: Name,
        tokens: ExtendedAsset[],
        nfts: u64[]
    ): void {
        // Authorization
        requireAuth(actor)

        // Pre-conditions
        this.checkContractIsNotPaused()

        // Substract Tokens and NFTs from actor balance
        this.substractBalance(actor, tokens, nfts)

        // Inline transfer Tokens and NFTs from contract to actor
        sendTransferTokens(this.contract, actor, tokens, "withdraw")
        sendTransferNfts(this.contract, actor, nfts, "withdraw")
    }

    /**
     * Withdraw all tokens and NFTs from the contract and transfer them to the actor.
     * Note:
     *  - Does not reduce balance
     *  - Assumes caller has already reduced balance using modifyBalance
     * @param {Name} actor - Name
     * @param {ExtendedAsset[]} tokens - The list of tokens to transfer.
     * @param {u64[]} nfts - u64[]
     * @param {string} memo - string
     */
    withdrawadmin(
        actor: Name,
        tokens: ExtendedAsset[],
        nfts: u64[],
        memo: string
    ): void {
        // Authorization
        // Not a public action, so only contract can call

        // Inline transfer Tokens and NFTs from contract to actor
        sendTransferTokens(this.contract, actor, tokens, memo)
        sendTransferNfts(this.contract, actor, nfts, memo)
    }

    /**
     * It substracts tokens and/or NFTs from an actor.
     * @param {Name} actor - The actor for which to modify balances
     * @param {ExtendedAsset[]} tokens - The list of tokens that are being added or removed from the actor.
     * @param {u64[]} nfts - The list of NFT asset ids
     * @param {Name} ramPayer - Account that pays for RAM 
     */
    substractBalance(actor: Name, tokens: ExtendedAsset[], nfts: u64[]): void {
        // Get account
        const account = this.accountsTable.requireGet(actor.N, `Account ${actor} not found`)

        // Substract Tokens + NFTs
        substractTokens(account, tokens)
        substractNfts(account, nfts)

        // Delete table if no NFTs and no tokens
        // Update table if any NFT or token found
        if (account.nfts.length == 0 && account.tokens.length == 0) {
            this.accountsTable.remove(account);
        } else {
            this.accountsTable.update(account, SAME_PAYER)
        }
    }

    /**
     * It adds tokens and/or NFTs from an actor.
     * @param {Name} actor - The actor for which to modify balances
     * @param {ExtendedAsset[]} tokens - The list of tokens that are being added or removed from the actor.
     * @param {u64[]} nfts - The list of NFT asset ids
     * @param {Name} ramPayer - Account that pays for RAM 
     */
    addBalance(actor: Name, tokens: ExtendedAsset[], nfts: u64[], ramPayer: Name = actor): void {
        // Get actor
        const account = this.accountsTable.getWithDefault(actor.N, new Account(actor))

        // Add Tokens + NFTs
        addTokens(account, tokens)
        addNfts(account, nfts)

        // Upsert table 
        this.accountsTable.set(account, ramPayer)
    }
}