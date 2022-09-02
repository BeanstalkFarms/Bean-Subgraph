import { Address, BigInt } from "@graphprotocol/graph-ts"
import { Cross } from "../../generated/schema"
import { dayFromTimestamp, hourFromTimestamp } from "./Dates"
import { ZERO_BD, ZERO_BI } from "./Decimals"

export function loadCross(id: i32, pool: Address, timestamp: BigInt): Cross {
    let cross = Cross.load(id.toString())
    if (cross == null) {
        let hour = hourFromTimestamp(timestamp)
        let day = dayFromTimestamp(timestamp)
        cross = new Cross(id.toString())
        cross.pool = pool.toHexString()
        cross.price = ZERO_BD
        cross.timestamp = timestamp
        cross.timeSinceLastCross = ZERO_BI
        cross.above = false
        cross.hourlySnapshot = hour
        cross.dailySnapshot = day
        cross.poolHourlySnapshot = cross.pool + '-' + hour
        cross.poolDailySnapshot = cross.pool + '-' + day
        cross.save()
    }
    return cross as Cross
}
