import { Address, BigInt } from "@graphprotocol/graph-ts";
import { Pool, PoolDailySnapshot, PoolHourlySnapshot } from "../../generated/schema";
import { loadBean } from "./Bean";
import { BEAN_ERC20 } from "./Constants";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { ZERO_BD, ZERO_BI } from "./Decimals";

export function loadPool(poolAddress: Address): Pool {
    let pool = Pool.load(poolAddress.toHexString())
    if (pool == null) {
        pool = new Pool(poolAddress.toHexString())
        pool.bean = BEAN_ERC20.toHexString()
        pool.totalVolume = ZERO_BI
        pool.totalVolumeUSD = ZERO_BD
        pool.totalBeansInLiquidity = ZERO_BI
        pool.totalLiquidityUSD = ZERO_BD
        pool.utilization = ZERO_BD
        pool.price = ZERO_BD
        pool.totalCrosses = 0
        pool.lastCross = ZERO_BI
        pool.deltaBeans = ZERO_BI
        pool.save()

        let bean = loadBean()
        let newPools = bean.pools
        newPools.push(pool.id)
        bean.pools = newPools
        bean.save()
    }
    return pool as Pool
}

export function loadPoolHourlySnapshot(poolAddress: Address, timestamp: BigInt): PoolHourlySnapshot {
    let hour = hourFromTimestamp(timestamp)
    let id = poolAddress.toHexString() + '-' + hour
    let snapshot = PoolHourlySnapshot.load(id)
    if (snapshot == null) {
        let pool = loadPool(poolAddress)
        snapshot = new PoolHourlySnapshot(id)
        snapshot.pool = pool.id
        snapshot.totalVolume = pool.totalVolume
        snapshot.totalVolumeUSD = pool.totalVolumeUSD
        snapshot.totalBeansInLiquidity = pool.totalBeansInLiquidity
        snapshot.totalLiquidityUSD = pool.totalLiquidityUSD
        snapshot.utilization = ZERO_BD
        snapshot.price = pool.price
        snapshot.totalCrosses = pool.totalCrosses
        snapshot.deltaBeans = ZERO_BI
        snapshot.hourlyVolume = ZERO_BI
        snapshot.hourlyVolumeUSD = ZERO_BD
        snapshot.hourlyBeansInLiquidity = ZERO_BI
        snapshot.hourlyLiquidityUSD = ZERO_BD
        snapshot.hourlyCrosses = 0
        snapshot.season = 6074
        snapshot.timestamp = BigInt.fromString(hour)
        snapshot.blockNumber = ZERO_BI
        snapshot.lastUpdated = timestamp
        snapshot.save()
    }
    return snapshot as PoolHourlySnapshot
}

export function loadPoolDailySnapshot(poolAddress: Address, timestamp: BigInt): PoolDailySnapshot {
    let day = dayFromTimestamp(timestamp)
    let id = poolAddress.toHexString() + '-' + day
    let snapshot = PoolDailySnapshot.load(id)
    if (snapshot == null) {
        let pool = loadPool(poolAddress)
        snapshot = new PoolDailySnapshot(id)
        snapshot.pool = pool.id
        snapshot.totalVolume = pool.totalVolume
        snapshot.totalVolumeUSD = pool.totalVolumeUSD
        snapshot.totalBeansInLiquidity = pool.totalBeansInLiquidity
        snapshot.totalLiquidityUSD = pool.totalLiquidityUSD
        snapshot.utilization = ZERO_BD
        snapshot.price = pool.price
        snapshot.totalCrosses = pool.totalCrosses
        snapshot.deltaBeans = ZERO_BI
        snapshot.dailyVolume = ZERO_BI
        snapshot.dailyVolumeUSD = ZERO_BD
        snapshot.dailyBeansInLiquidity = ZERO_BI
        snapshot.dailyLiquidityUSD = ZERO_BD
        snapshot.dailyCrosses = 0
        snapshot.season = 6074
        snapshot.timestamp = BigInt.fromString(day)
        snapshot.blockNumber = ZERO_BI
        snapshot.lastUpdated = timestamp
        snapshot.save()
    }
    return snapshot as PoolDailySnapshot
}
