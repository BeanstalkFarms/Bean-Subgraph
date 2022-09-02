import { BigInt, BigDecimal, log, Address } from "@graphprotocol/graph-ts";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityImbalance, RemoveLiquidityOne, TokenExchange, TokenExchangeUnderlying } from "../generated/Bean3CRV/Bean3CRV";
import { CurvePrice } from "../generated/Bean3CRV/CurvePrice";
import { loadBean, loadBeanDailySnapshot, loadBeanHourlySnapshot } from "./utils/Bean";
import { CURVE_PRICE } from "./utils/Constants";
import { loadCross } from "./utils/Cross";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "./utils/Decimals";
import { loadPool, loadPoolDailySnapshot, loadPoolHourlySnapshot } from "./utils/Pool";

export function handleTokenExchange(event: TokenExchange): void {
    // Get Curve Price Details
    let curvePrice = CurvePrice.bind(CURVE_PRICE)
    let curve = curvePrice.try_getCurve()

    if (curve.reverted) { return }

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(event.block.timestamp)
    let beanDaily = loadBeanDailySnapshot(event.block.timestamp)

    let oldPrice = bean.price
    let newPrice = toDecimal(curve.value.price)
    let beanVolume = ZERO_BI

    if (event.params.sold_id == ZERO_BI) {
        beanVolume = event.params.tokens_sold
    } else if (event.params.bought_id == ZERO_BI) {
        beanVolume = event.params.tokens_bought
    }
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.totalLiquidityUSD)
    let volumeUSD = toDecimal(beanVolume).times(newPrice)

    bean.totalVolume = bean.totalVolume.plus(beanVolume)
    bean.totalVolumeUSD = bean.totalVolumeUSD.plus(volumeUSD)
    //bean.totalLiquidity = curve.value.lpBdv
    bean.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.marketCap = toDecimal(bean.totalSupply).times(bean.price)
    bean.save()

    beanHourly.totalVolume = bean.totalVolume
    beanHourly.totalVolumeUSD = bean.totalVolumeUSD
    beanHourly.totalLiquidityUSD = bean.totalLiquidityUSD
    beanHourly.price = bean.price
    beanHourly.marketCap = bean.marketCap
    beanHourly.hourlyVolume = beanHourly.hourlyVolume.plus(beanVolume)
    beanHourly.hourlyVolumeUSD = beanHourly.hourlyVolumeUSD.plus(volumeUSD)
    beanHourly.hourlyLiquidityUSD = beanHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.save()

    beanDaily.totalVolume = bean.totalVolume
    beanDaily.totalVolumeUSD = bean.totalVolumeUSD
    beanDaily.totalLiquidityUSD = bean.totalLiquidityUSD
    beanDaily.price = bean.price
    beanDaily.marketCap = bean.marketCap
    beanDaily.dailyVolume = beanDaily.dailyVolume.plus(beanVolume)
    beanDaily.dailyVolumeUSD = beanDaily.dailyVolumeUSD.plus(volumeUSD)
    beanDaily.dailyLiquidityUSD = beanDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.save()

    let pool = loadPool(event.address)
    let poolHourly = loadPoolHourlySnapshot(event.address, event.block.timestamp)
    let poolDaily = loadPoolDailySnapshot(event.address, event.block.timestamp)

    pool.totalVolume = pool.totalVolume.plus(beanVolume)
    pool.totalVolumeUSD = pool.totalVolumeUSD.plus(volumeUSD)
    pool.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    pool.price = toDecimal(curve.value.price)
    pool.save()

    poolHourly.totalVolume = pool.totalVolume
    poolHourly.totalVolumeUSD = pool.totalVolumeUSD
    poolHourly.totalLiquidityUSD = pool.totalLiquidityUSD
    poolHourly.price = pool.price
    poolHourly.hourlyLiquidityUSD = poolHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    poolHourly.hourlyVolume = poolHourly.hourlyVolume.plus(beanVolume)
    poolHourly.hourlyVolumeUSD = poolHourly.hourlyVolumeUSD.plus(volumeUSD)
    poolHourly.utilization = poolHourly.hourlyVolumeUSD.div(poolHourly.totalLiquidityUSD)
    poolHourly.lastUpdated = event.block.timestamp
    poolHourly.blockNumber = event.block.number
    poolHourly.save()

    poolDaily.totalVolume = pool.totalVolume
    poolDaily.totalVolumeUSD = pool.totalVolumeUSD
    poolDaily.totalLiquidityUSD = pool.totalLiquidityUSD
    poolDaily.price = pool.price
    poolDaily.dailyLiquidityUSD = poolDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    poolDaily.dailyVolume = poolDaily.dailyVolume.plus(beanVolume)
    poolDaily.dailyVolumeUSD = poolDaily.dailyVolumeUSD.plus(volumeUSD)
    poolDaily.utilization = poolDaily.dailyVolumeUSD.div(poolDaily.totalLiquidityUSD)
    poolDaily.lastUpdated = event.block.timestamp
    poolDaily.blockNumber = event.block.number
    poolDaily.save()

    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        handleCrossBelow(event.address, event.block.timestamp, newPrice)
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        handleCrossAbove(event.address, event.block.timestamp, newPrice)
    }
}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {

    // Get Curve Price Details
    let curvePrice = CurvePrice.bind(CURVE_PRICE)
    let curve = curvePrice.try_getCurve()

    if (curve.reverted) { return }

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(event.block.timestamp)
    let beanDaily = loadBeanDailySnapshot(event.block.timestamp)

    let oldPrice = bean.price
    let newPrice = toDecimal(curve.value.price)
    let beanVolume = ZERO_BI

    if (event.params.sold_id == ZERO_BI) {
        beanVolume = event.params.tokens_sold
    } else if (event.params.bought_id == ZERO_BI) {
        beanVolume = event.params.tokens_bought
    }
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.totalLiquidityUSD)
    let volumeUSD = toDecimal(beanVolume).times(newPrice)

    bean.totalVolume = bean.totalVolume.plus(beanVolume)
    bean.totalVolumeUSD = bean.totalVolumeUSD.plus(volumeUSD)
    //bean.totalLiquidity = curve.value.lpBdv
    bean.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.marketCap = toDecimal(bean.totalSupply).times(bean.price)
    bean.save()

    beanHourly.totalVolume = bean.totalVolume
    beanHourly.totalVolumeUSD = bean.totalVolumeUSD
    beanHourly.totalLiquidityUSD = bean.totalLiquidityUSD
    beanHourly.price = bean.price
    beanHourly.marketCap = bean.marketCap
    beanHourly.hourlyVolume = beanHourly.hourlyVolume.plus(beanVolume)
    beanHourly.hourlyVolumeUSD = beanHourly.hourlyVolumeUSD.plus(volumeUSD)
    beanHourly.hourlyLiquidityUSD = beanHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.save()

    beanDaily.totalVolume = bean.totalVolume
    beanDaily.totalVolumeUSD = bean.totalVolumeUSD
    beanDaily.totalLiquidityUSD = bean.totalLiquidityUSD
    beanDaily.price = bean.price
    beanDaily.marketCap = bean.marketCap
    beanDaily.dailyVolume = beanDaily.dailyVolume.plus(beanVolume)
    beanDaily.dailyVolumeUSD = beanDaily.dailyVolumeUSD.plus(volumeUSD)
    beanDaily.dailyLiquidityUSD = beanDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.save()

    let pool = loadPool(event.address)
    let poolHourly = loadPoolHourlySnapshot(event.address, event.block.timestamp)
    let poolDaily = loadPoolDailySnapshot(event.address, event.block.timestamp)

    pool.totalVolume = pool.totalVolume.plus(beanVolume)
    pool.totalVolumeUSD = pool.totalVolumeUSD.plus(volumeUSD)
    pool.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    pool.price = toDecimal(curve.value.price)
    pool.save()

    poolHourly.totalVolume = pool.totalVolume
    poolHourly.totalVolumeUSD = pool.totalVolumeUSD
    poolHourly.totalLiquidityUSD = pool.totalLiquidityUSD
    poolHourly.price = pool.price
    poolHourly.hourlyLiquidityUSD = poolHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    poolHourly.hourlyVolume = poolHourly.hourlyVolume.plus(beanVolume)
    poolHourly.hourlyVolumeUSD = poolHourly.hourlyVolumeUSD.plus(volumeUSD)
    poolHourly.utilization = poolHourly.hourlyVolumeUSD.div(poolHourly.totalLiquidityUSD)
    poolHourly.lastUpdated = event.block.timestamp
    poolHourly.blockNumber = event.block.number
    poolHourly.save()

    poolDaily.totalVolume = pool.totalVolume
    poolDaily.totalVolumeUSD = pool.totalVolumeUSD
    poolDaily.totalLiquidityUSD = pool.totalLiquidityUSD
    poolDaily.price = pool.price
    poolDaily.dailyLiquidityUSD = poolDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    poolDaily.dailyVolume = poolDaily.dailyVolume.plus(beanVolume)
    poolDaily.dailyVolumeUSD = poolDaily.dailyVolumeUSD.plus(volumeUSD)
    poolDaily.utilization = poolDaily.dailyVolumeUSD.div(poolDaily.totalLiquidityUSD)
    poolDaily.lastUpdated = event.block.timestamp
    poolDaily.blockNumber = event.block.number
    poolDaily.save()

    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        handleCrossBelow(event.address, event.block.timestamp, newPrice)
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        handleCrossAbove(event.address, event.block.timestamp, newPrice)
    }
}

export function handleAddLiquidity(event: AddLiquidity): void {
    handleLiquidityChange(event.address, event.block.timestamp, event.params.token_amounts[0], event.params.token_amounts[1], event.block.number)
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
    handleLiquidityChange(event.address, event.block.timestamp, event.params.token_amounts[0], event.params.token_amounts[1], event.block.number)
}

export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
    handleLiquidityChange(event.address, event.block.timestamp, event.params.token_amounts[0], event.params.token_amounts[1], event.block.number)
}

export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
    handleLiquidityChange(event.address, event.block.timestamp, event.params.token_amount, ZERO_BI, event.block.number)
}

function handleCrossBelow(poolAddress: Address, timestamp: BigInt, newPrice: BigDecimal): void {
    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(timestamp)
    let beanDaily = loadBeanDailySnapshot(timestamp)

    let pool = loadPool(poolAddress)
    let poolHourly = loadPoolHourlySnapshot(poolAddress, timestamp)
    let poolDaily = loadPoolDailySnapshot(poolAddress, timestamp)

    let cross = loadCross(bean.totalCrosses + 1, poolAddress, timestamp)
    cross.price = newPrice
    cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
    cross.above = false
    cross.save()

    bean.lastCross = timestamp
    bean.totalCrosses += 1
    bean.save()

    beanHourly.totalCrosses += 1
    beanHourly.hourlyCrosses += 1
    beanHourly.save()

    beanDaily.totalCrosses += 1
    beanDaily.dailyCrosses += 1
    beanDaily.save()

    pool.lastCross = timestamp
    pool.totalCrosses += 1
    pool.save()

    poolHourly.totalCrosses += 1
    poolHourly.hourlyCrosses += 1
    poolHourly.save()

    poolDaily.totalCrosses += 1
    poolDaily.dailyCrosses += 1
    poolDaily.save()
}

function handleCrossAbove(poolAddress: Address, timestamp: BigInt, newPrice: BigDecimal): void {
    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(timestamp)
    let beanDaily = loadBeanDailySnapshot(timestamp)

    let pool = loadPool(poolAddress)
    let poolHourly = loadPoolHourlySnapshot(poolAddress, timestamp)
    let poolDaily = loadPoolDailySnapshot(poolAddress, timestamp)

    let cross = loadCross(bean.totalCrosses + 1, poolAddress, timestamp)
    cross.price = newPrice
    cross.timeSinceLastCross = timestamp.minus(bean.lastCross)
    cross.above = true
    cross.save()

    bean.lastCross = timestamp
    bean.totalCrosses += 1
    bean.save()

    beanHourly.totalCrosses += 1
    beanHourly.hourlyCrosses += 1
    beanHourly.save()

    beanDaily.totalCrosses += 1
    beanDaily.dailyCrosses += 1
    beanDaily.save()

    pool.lastCross = timestamp
    pool.totalCrosses += 1
    pool.save()

    poolHourly.totalCrosses += 1
    poolHourly.hourlyCrosses += 1
    poolHourly.save()

    poolDaily.totalCrosses += 1
    poolDaily.dailyCrosses += 1
    poolDaily.save()

}

function handleSwap(): void {

}

function handleLiquidityChange(poolAddress: Address, timestamp: BigInt, token0Amount: BigInt, token1Amount: BigInt, blockNumber: BigInt): void {
    // Get Curve Price Details
    let curvePrice = CurvePrice.bind(CURVE_PRICE)
    let curve = curvePrice.try_getCurve()

    if (curve.reverted) { return }

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(timestamp)
    let beanDaily = loadBeanDailySnapshot(timestamp)

    let oldPrice = bean.price
    let newPrice = toDecimal(curve.value.price)
    let deltaLiquidityUSD = toDecimal(curve.value.liquidity).minus(bean.totalLiquidityUSD)

    let volumeUSD = deltaLiquidityUSD < ZERO_BD ? deltaLiquidityUSD.div(BigDecimal.fromString('2')).times(BigDecimal.fromString('-1')) : deltaLiquidityUSD.div(BigDecimal.fromString('2'))
    let beanVolume = BigInt.fromString(volumeUSD.div(newPrice).times(BigDecimal.fromString('1000000')).truncate(0).toString())

    if (token0Amount !== ZERO_BI && token1Amount !== ZERO_BI) {
        volumeUSD = ZERO_BD
        beanVolume = ZERO_BI
    }
    bean.totalVolume = bean.totalVolume.plus(beanVolume)
    bean.totalVolumeUSD = bean.totalVolumeUSD.plus(volumeUSD)
    bean.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    bean.price = toDecimal(curve.value.price)
    bean.marketCap = toDecimal(bean.totalSupply).times(bean.price)
    bean.save()

    beanHourly.totalVolume = bean.totalVolume
    beanHourly.totalVolumeUSD = bean.totalVolumeUSD
    beanHourly.totalLiquidityUSD = bean.totalLiquidityUSD
    beanHourly.price = bean.price
    beanHourly.marketCap = bean.marketCap
    beanHourly.hourlyLiquidityUSD = beanHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    beanHourly.hourlyVolume = beanHourly.hourlyVolume.plus(beanVolume)
    beanHourly.hourlyVolumeUSD = beanHourly.hourlyVolumeUSD.plus(volumeUSD)
    beanHourly.save()

    beanDaily.totalVolume = bean.totalVolume
    beanDaily.totalVolumeUSD = bean.totalVolumeUSD
    beanDaily.totalLiquidityUSD = bean.totalLiquidityUSD
    beanDaily.price = bean.price
    beanDaily.marketCap = bean.marketCap
    beanDaily.dailyLiquidityUSD = beanDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    beanDaily.dailyVolume = beanDaily.dailyVolume.plus(beanVolume)
    beanDaily.dailyVolumeUSD = beanDaily.dailyVolumeUSD.plus(volumeUSD)
    beanDaily.save()

    let pool = loadPool(poolAddress)
    let poolHourly = loadPoolHourlySnapshot(poolAddress, timestamp)
    let poolDaily = loadPoolDailySnapshot(poolAddress, timestamp)

    pool.totalVolume = pool.totalVolume.plus(beanVolume)
    pool.totalVolumeUSD = pool.totalVolumeUSD.plus(volumeUSD)
    pool.totalLiquidityUSD = toDecimal(curve.value.liquidity)
    pool.price = toDecimal(curve.value.price)
    pool.save()

    poolHourly.totalVolume = pool.totalVolume
    poolHourly.totalVolumeUSD = pool.totalVolumeUSD
    poolHourly.totalLiquidityUSD = pool.totalLiquidityUSD
    poolHourly.price = pool.price
    poolHourly.hourlyLiquidityUSD = poolHourly.hourlyLiquidityUSD.plus(deltaLiquidityUSD)
    poolHourly.hourlyVolume = poolHourly.hourlyVolume.plus(beanVolume)
    poolHourly.hourlyVolumeUSD = poolHourly.hourlyVolumeUSD.plus(volumeUSD)
    poolHourly.utilization = poolHourly.hourlyVolumeUSD.div(poolHourly.totalLiquidityUSD)
    poolHourly.lastUpdated = timestamp
    poolHourly.blockNumber = blockNumber
    poolHourly.save()

    poolDaily.totalVolume = pool.totalVolume
    poolDaily.totalVolumeUSD = pool.totalVolumeUSD
    poolDaily.totalLiquidityUSD = pool.totalLiquidityUSD
    poolDaily.price = pool.price
    poolDaily.dailyLiquidityUSD = poolDaily.dailyLiquidityUSD.plus(deltaLiquidityUSD)
    poolDaily.dailyVolume = poolDaily.dailyVolume.plus(beanVolume)
    poolDaily.dailyVolumeUSD = poolDaily.dailyVolumeUSD.plus(volumeUSD)
    poolDaily.utilization = poolDaily.dailyVolumeUSD.div(poolDaily.totalLiquidityUSD)
    poolDaily.lastUpdated = timestamp
    poolDaily.blockNumber = blockNumber
    poolDaily.save()


    // Handle a peg cross
    if (oldPrice >= ONE_BD && newPrice < ONE_BD) {
        handleCrossBelow(poolAddress, timestamp, newPrice)
    }

    if (oldPrice < ONE_BD && newPrice >= ONE_BD) {
        handleCrossAbove(poolAddress, timestamp, newPrice)
    }
}
