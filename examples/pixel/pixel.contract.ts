import { Name, Table, check, requireAuth, TableStore, ExtendedAsset, Utils, Asset } from 'proton-tsc'
import { BalanceContract } from 'proton-tsc/balance';
import { estimateBuyRamCost, sendBuyRamBytes } from 'proton-tsc/system/modules/ram';
import { XPR_SYMBOL, XPR_CONTRACT } from 'proton-tsc/system/constants';

const MULTIPLIER: f64 = 1.5
const ROW_RAM_COST: u8 = 136

@table("pixels")
export class Pixels extends Table {
    constructor (
        public id: u64 = 0,
        public owner: Name = new Name(),
        public price: u64 = 0,
        public color: u8[] = []
    ) {
        super();
    }

    @primary
    get primary(): u64 {
        return this.id;
    }
}

@contract
export class PixelContract extends BalanceContract {
    pixelsTable: TableStore<Pixels> = new TableStore<Pixels>(this.receiver)

    @action("buypixel")
    buypixel(
        newOwner: Name,
        pixelId: u64,
        pixelColor: string
    ): void {
        // Authorization
        requireAuth(newOwner)

        // Check
        check(pixelId < 1000000, "Max pixel ID is 999999")
        check(pixelColor.length == 6, "Pixel color must be 6 character hex")

        // Get pixel
        let pixel = this.pixelsTable.get(pixelId)

        // Determine price
        const newPriceAmount = pixel
            ? <u64>(Math.ceil(<f64>pixel.price * MULTIPLIER))
            : estimateBuyRamCost(ROW_RAM_COST).amount
        const newPriceQuantity = new ExtendedAsset(new Asset(newPriceAmount, XPR_SYMBOL), XPR_CONTRACT)

        // Charge amount
        this.substractBalance(newOwner, [newPriceQuantity], [])
        if (pixel) {
            this.addBalance(pixel.owner, [newPriceQuantity], [])
        } else {
            sendBuyRamBytes(this.contract, this.contract, this.contract, 136)
        }
        
        // Save pixel
        const newPixel = new Pixels(pixelId, newOwner, newPriceAmount, Utils.hexToBytes(pixelColor))
        this.pixelsTable.set(newPixel, this.contract)
    }
}