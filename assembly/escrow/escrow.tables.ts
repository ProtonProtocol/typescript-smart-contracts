import { ExtendedAsset, Name, Table, Singleton, TableStore, IDX64, IDXDB } from "../index";

@table("escrowglobal", singleton)
export class EscrowGlobal extends Table {
    constructor (
       public escrowId: u64 = 0
    ) {
        super();
    }

    static getSingleton(code: Name): Singleton<EscrowGlobal> {
        return new Singleton<EscrowGlobal>(code, code, Name.fromString("escrowglobal"));
    }
}

@table("escrows")
export class Escrow extends Table {
    constructor (
       public id: u64 = 0,
       public from: Name = new Name(),
       public to: Name = new Name(),
       public fromTokens: ExtendedAsset[] = [],
       public fromNfts: u64[] = [],
       public toTokens: ExtendedAsset[] = [],
       public toNfts: u64[] = [],
       public expiry: u32 = 0
    ) {
        super();
    }

    @primary
    get primary(): u64 {
        return this.id;
    }

    @secondary
    get byFrom(): u64 {
        return this.from.N;
    }

    set byFrom(value: u64) {
        this.from.N = value;
    }

    @secondary
    get byTo(): u64 {
        return this.to.N;
    }

    set byTo(value: u64) {
        this.to.N = value;
    }
   
    static getTable(code: Name): TableStore<Escrow> {
        const scope = code
        const tableName = Name.fromString("escrows")
        const idxTableBase: u64 = (tableName.N & 0xfffffffffffffff0);
        const indexes: IDXDB[] = [
            new IDX64(code.N, scope.N, idxTableBase + 0, 0),
            new IDX64(code.N, scope.N, idxTableBase + 1, 0),
        ];
        return new TableStore<Escrow>(code, code, tableName, indexes);
    }
}