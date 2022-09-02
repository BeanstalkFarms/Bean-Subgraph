import { BigDecimal, BigInt } from "@graphprotocol/graph-ts"
import { Bean, BeanDailySnapshot, BeanHourlySnapshot } from "../../generated/schema"
import { BEAN_ERC20 } from "./Constants"
import { dayFromTimestamp, hourFromTimestamp } from "./Dates"
import { ZERO_BD, ZERO_BI } from "./Decimals"

export function loadBean(): Bean {
    let bean = Bean.load(BEAN_ERC20.toHexString())
    if (bean == null) {
        bean = new Bean(BEAN_ERC20.toHexString())
        bean.decimals = BigInt.fromI32(6)
        bean.totalSupply = ZERO_BI
        bean.marketCap = ZERO_BD
        bean.totalVolume = ZERO_BI
        bean.totalVolumeUSD = ZERO_BD
        bean.totalBeansInLiquidity = ZERO_BI
        bean.totalLiquidityUSD = ZERO_BD
        bean.price = BigDecimal.fromString('1.072') // Initial replant value
        bean.totalCrosses = 0
        bean.lastCross = ZERO_BI
        bean.pools = []
        bean.save()
    }
    return bean as Bean
}

export function loadBeanHourlySnapshot(timestamp: BigInt): BeanHourlySnapshot {
    let hour = hourFromTimestamp(timestamp)
    let snapshot = BeanHourlySnapshot.load(hour)
    if (snapshot == null) {
        let bean = loadBean()
        snapshot = new BeanHourlySnapshot(hour)
        snapshot.bean = BEAN_ERC20.toHexString()
        snapshot.totalSupply = ZERO_BI
        snapshot.marketCap = bean.marketCap
        snapshot.totalVolume = bean.totalVolume
        snapshot.totalVolumeUSD = bean.totalVolumeUSD
        snapshot.totalBeansInLiquidity = bean.totalBeansInLiquidity
        snapshot.totalLiquidityUSD = bean.totalLiquidityUSD
        snapshot.price = bean.price
        snapshot.totalCrosses = bean.totalCrosses
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
    return snapshot as BeanHourlySnapshot
}

export function loadBeanDailySnapshot(timestamp: BigInt): BeanDailySnapshot {
    let day = dayFromTimestamp(timestamp)
    let snapshot = BeanDailySnapshot.load(day)
    if (snapshot == null) {
        let bean = loadBean()
        snapshot = new BeanDailySnapshot(day)
        snapshot.bean = BEAN_ERC20.toHexString()
        snapshot.totalSupply = ZERO_BI
        snapshot.marketCap = bean.marketCap
        snapshot.totalVolume = bean.totalVolume
        snapshot.totalVolumeUSD = bean.totalVolumeUSD
        snapshot.totalBeansInLiquidity = bean.totalBeansInLiquidity
        snapshot.totalLiquidityUSD = bean.totalLiquidityUSD
        snapshot.price = bean.price
        snapshot.totalCrosses = bean.totalCrosses
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
    return snapshot as BeanDailySnapshot
}
