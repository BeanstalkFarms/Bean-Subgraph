import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import { Pair, Bean, Supply, Price, Pool, BeanDayData, BeanHourData, PoolDayData, PoolHourData, Cross } from "../generated/schema"
import { ADDRESS_ZERO, ZERO_BI, ONE_BI, ZERO_BD, ONE_BD, BI_6, BI_18, convertTokenToDecimal, exponentToBigDecimal } from "./helpers"

import {
  Transfer,
  Sync,
  Swap
} from "../generated/BeanUniswapV2Pair/UniswapV2Pair"

import {
  AddLiquidity,
  TokenExchange
} from "../generated/Bean3CRVPair/BEAN3CRV"

//tokens addresses
let beanAddress = Address.fromString('0xdc59ac4fefa32293a95889dc396682858d52e5db')
let lusdAddress = Address.fromString('0x5f98805A4E8be255a32880FDeC7F6728C6568bA0')

//3crv pools
let crv3Address = Address.fromString('0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490')
let lusd3crvAddress = Address.fromString('0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA')

//DAI-USDC-USDT curve pool
let curveAddress = Address.fromString('0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7')

//bean curve factories
let beancrv3PairAddress = Address.fromString('0x3a70DfA7d2262988064A2D051dd47521E43c9BdD') // block start 13954026
let beanlusdPairAddress = Address.fromString('0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D')

//uniswap pairs
let beanPairAddress = Address.fromString('0x87898263b6c5babe34b4ec53f22d98430b91e371')
let usdcPairAddress = Address.fromString('0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc')

export function handleSync(event: Sync): void {

let pair = Pair.load(event.address.toHex())
if (pair == null) pair = initializePair(event.address)

pair.reserve0 = convertTokenToDecimal(event.params.reserve0, pair.decimals0)
pair.reserve1 = convertTokenToDecimal(event.params.reserve1, pair.decimals1)

pair.save()

let beanPair = Pair.load(beanPairAddress.toHex())
let usdcPair = Pair.load(usdcPairAddress.toHex())

if (beanPair != null && usdcPair != null) {

  let timestamp = event.block.timestamp.toI32()
  let timeD = (timestamp / 86400).toString()
  let timeH = (timestamp / 3600).toString()
  let timestampD = timestamp / 86400
  let timestampH = timestamp / 3600

  if (event.address.toHexString() == beanPairAddress.toHexString()){

  let pool = getPool(event.address, timestamp)
  let dayId = pool.id.concat('-').concat(timeD)
  let dayData = getPoolDayData(dayId, timestampD, pool!)
  let hourId = pool.id.concat('-').concat(timeH)
  let hourData = getPoolHourData(hourId, timestampH, pool!)
  pool.reserve0 = beanPair.reserve0
  pool.reserve1 = beanPair.reserve1
  pool.price = (beanPair.reserve0 / beanPair.reserve1) * (usdcPair.reserve0 / usdcPair.reserve1)
  let delta = ((beanPair.reserve0 * usdcPair.reserve0) / (usdcPair.reserve1) - beanPair.reserve1).div(BigDecimal.fromString('2'))
  getCross(event.block.timestamp, delta, dayData.id, hourData.id ,pool)
  pool.delta = ((beanPair.reserve0 * usdcPair.reserve0) / (usdcPair.reserve1) - beanPair.reserve1).div(BigDecimal.fromString('2'))
  pool.save()
  updatePoolData(timestamp, pool)
  getLiquidity(beanPairAddress, timestamp, pool)
  }
}
}

export function handleTokenExchange(event: TokenExchange): void {

//calculate BEANLUSD pool price with exchange
if (event.address.toHexString() == beanlusdPairAddress.toHexString()){
// BeanLUSD exchange volume + utilisation LP calculation
let pool = getPool(event.address, event.block.timestamp.toI32())
let BEAN = BigInt.fromI32(0)
let LUSD = BigInt.fromI32(1)

  if (event.params.sold_id == LUSD && event.params.bought_id == BEAN){
    pool.volumeBean = convertTokenToDecimal(event.params.tokens_bought, BI_6)
    pool.amount1 = convertTokenToDecimal(event.params.tokens_sold, BI_18)
    pool.volumeUSD = pool.volumeBean * pool.price
    updatePoolDataVolume(event.block.timestamp.toI32(), pool)
    updatePoolData(event.block.timestamp.toI32(), pool)
  }
  if (event.params.sold_id == BEAN && event.params.bought_id == LUSD){
    pool.volumeBean = convertTokenToDecimal(event.params.tokens_sold, BI_6)
    pool.amount1 = convertTokenToDecimal(event.params.tokens_bought, BI_18)
    pool.volumeUSD = pool.volumeBean * pool.price
    updatePoolDataVolume(event.block.timestamp.toI32(), pool)
    updatePoolData(event.block.timestamp.toI32(), pool)
  }
}
}

export function handleAddLiquidity(event: AddLiquidity): void {

// 3Curve pool 3 COINS invariant and LP value 
let timestamp = event.block.timestamp.toI32()
// BEAN3CRV pool
if (event.address.toHexString() == curveAddress.toHexString()){
  let pool = getPool(beancrv3PairAddress, timestamp)
  pool.invariant = convertTokenToDecimal(event.params.invariant, BI_18)
  pool.tokensupply = convertTokenToDecimal(event.params.token_supply, BI_18)
  pool.save()
// BEANLUSD pool
  pool = getPool(beanlusdPairAddress, timestamp)
  pool.invariant = convertTokenToDecimal(event.params.invariant, BI_18)
  pool.tokensupply = convertTokenToDecimal(event.params.token_supply, BI_18)
  pool.save()
// LUSD3CRV pool
  pool = getPool(lusd3crvAddress, timestamp)
  pool.invariant = convertTokenToDecimal(event.params.invariant, BI_18)
  pool.tokensupply = convertTokenToDecimal(event.params.token_supply, BI_18)
  pool.save()
}
}

export function handleSwap(event: Swap): void {

let timestamp = event.block.timestamp.toI32()
// Bean Uniswap Volume calculation 

if (event.address.toHexString() == beanPairAddress.toHexString()){
   let pool = getPool(beanPairAddress, timestamp)
   let amount1In = convertTokenToDecimal(event.params.amount1In, BI_6)
   let amount1Out = convertTokenToDecimal(event.params.amount1Out, BI_6)
   let total1 = amount1In.plus(amount1Out)
   pool.volumeBean = total1
   pool.volumeUSD = pool.volumeBean * pool.price
   pool.save()
   updatePoolDataVolume(timestamp, pool)
}
}

export function handleTransfer(event: Transfer): void {

let timestamp = event.block.timestamp.toI32()
if (event.address.toHexString() == beanAddress.toHexString()){
// Bean Supply calculation
let bean = getBean(timestamp)

let value = convertTokenToDecimal(event.params.value, BI_6)

if (event.params.from.toHexString() == ADDRESS_ZERO) bean.totalSupply = bean.totalSupply.plus(value)
else if (event.params.to.toHexString() == ADDRESS_ZERO) bean.totalSupply = bean.totalSupply.minus(value)
getAveragePrice(timestamp)
bean.totalSupplyUSD = bean.totalSupply.times(bean.averagePrice)
bean.save()

let supplyId = event.block.timestamp.toString()
let supply = Supply.load(supplyId)
if (supply === null) {
  supply = new Supply(supplyId)
  supply.bean = bean.id
  supply.timestamp = event.block.timestamp
}
supply.totalSupply = bean.totalSupply
supply.totalSupplyUSD = bean.totalSupplyUSD
supply.save()

updateBeanData(timestamp, bean)
}

let timeD = (timestamp / 86400).toString()
let timeH = (timestamp / 3600).toString()
let timestampD = timestamp / 86400
let timestampH = timestamp / 3600

let pool = getPool(event.address, timestamp)
let dayId = pool.id.concat('-').concat(timeD)
let dayData = getPoolDayData(dayId, timestampD, pool!)
let hourId = pool.id.concat('-').concat(timeH)
let hourData = getPoolHourData(hourId, timestampH, pool!)

// Reserves calculation for BEAN3CRV pool with CRV3 pool reserves + BEAN3CRV Pair update  
   // Increase reserve0 of Bean3crv pool
if (event.address.toHexString() == beanAddress.toHexString()){
let reserve0 = convertTokenToDecimal(event.params.value, BI_6)
   if (event.params.to.toHexString() == beancrv3PairAddress.toHexString() && event.params.from.toHexString() !== ADDRESS_ZERO){
   let pool = getPool(beancrv3PairAddress, timestamp)
   pool.txn = event.transaction.hash.toHexString()
   pool.reserve0 = pool.reserve0.plus(reserve0)
   pool.token0 = event.address.toHex()
   pool.volumeBean = reserve0
   pool.volumeUSD = pool.volumeBean * pool.price
   pool.save()
   updatePoolDataVolume(timestamp, pool)
   if (pool.volumeBean == ZERO_BD) return
   let pair = Pair.load(beancrv3PairAddress.toHex())
   if (pair == null) pair = initializePair(beancrv3PairAddress)
   pair.reserve0 = pool.reserve0
   pair.save()
   updatePoolData(timestamp, pool)
   getLiquidity(beancrv3PairAddress, timestamp, pool)
   }
   // Decrease reserve0 of Bean3crv pool
   if (event.params.from.toHexString() == beancrv3PairAddress.toHexString() && event.params.to.toHexString() !== ADDRESS_ZERO){ 
    let pool = getPool(beancrv3PairAddress, timestamp)
    pool.txn = event.transaction.hash.toHexString()
    pool.reserve0 = pool.reserve0.minus(reserve0)
    pool.token0 = event.address.toHex()
    pool.volumeBean = reserve0
    pool.volumeUSD = pool.volumeBean * pool.price
    pool.save()
    updatePoolDataVolume(timestamp, pool)
    if (pool.volumeBean == ZERO_BD) return
    let pair = Pair.load(beancrv3PairAddress.toHex())
    if (pair == null) pair = initializePair(beancrv3PairAddress)
    pair.reserve0 = pool.reserve0
    pair.save()
    updatePoolData(timestamp, pool)
    getLiquidity(beancrv3PairAddress, timestamp, pool)
   }
}
// Increase reserve1 of Bean3crv pool
if (event.address.toHexString() == crv3Address.toHexString()){
let reserve1 = convertTokenToDecimal(event.params.value, BI_18)
   if (event.params.to.toHexString() == beancrv3PairAddress.toHexString()){
   let pool = getPool(beancrv3PairAddress, timestamp)  
   pool.reserve1 = pool.reserve1.plus(reserve1)
   pool.token1 = event.address.toHex()
   pool.save()
   getLiquidity(beancrv3PairAddress, timestamp, pool)
   let txn = event.transaction.hash.toHexString()
   if (pool.txn == txn && event.params.from.toHexString() == ADDRESS_ZERO && pool.volumeBean !== ZERO_BD){
   pool.amount1 = reserve1
   pool.save()
   getCurve(event.block.timestamp, dayData.id, hourData.id, pool)
   getLiquidity(beancrv3PairAddress, timestamp, pool)
   }
   let pair = Pair.load(beancrv3PairAddress.toHex())
   if (pair == null) pair = initializePair(beancrv3PairAddress)
   pair.reserve1 = pool.reserve1
   pair.save()
   updatePoolData(timestamp, pool)
   }
   // Decrease reserve1 of Bean3crv pool
   if (event.params.from.toHexString() == beancrv3PairAddress.toHexString()){
   let pool = getPool(beancrv3PairAddress, timestamp)  
   pool.reserve1 = pool.reserve1.minus(reserve1)
   pool.token1 = event.address.toHex()
   pool.save()
   getLiquidity(beancrv3PairAddress, timestamp, pool)
   let txn = event.transaction.hash.toHexString()
   if (pool.txn == txn && event.params.to.toHexString() == ADDRESS_ZERO && pool.volumeBean !== ZERO_BD){
   pool.amount1 = reserve1
   pool.save()
   getCurve(event.block.timestamp, dayData.id, hourData.id, pool)
   getLiquidity(beancrv3PairAddress, timestamp, pool)
   }
   let pair = Pair.load(beancrv3PairAddress.toHex())
   if (pair == null) pair = initializePair(beancrv3PairAddress)
   pair.reserve1 = pool.reserve1
   pair.save()
   updatePoolData(timestamp, pool)
   }
}

// Reserves calculation for BEANLUSD pool with CRV3 pool reserves + BEANLUSD Pair update 
     // Increase reserve0 of BeanLusd pool
if (event.address.toHexString() == beanAddress.toHexString()){
  let reserve0 = convertTokenToDecimal(event.params.value, BI_6)
     if (event.params.to.toHexString() == beanlusdPairAddress.toHexString() && event.params.from.toHexString() !== ADDRESS_ZERO){
     let pool = getPool(beanlusdPairAddress, timestamp)
     pool.reserve0 = pool.reserve0.plus(reserve0)
     pool.token0 = event.address.toHex()
     pool.save()
     let pair = Pair.load(beanlusdPairAddress.toHex())
     if (pair == null) pair = initializePair(beanlusdPairAddress)  
     pair.reserve0 = pool.reserve0
     pair.save()
     updatePoolData(timestamp, pool)
     getLiquidity(beancrv3PairAddress, timestamp, pool)
     }
     // Decrease reserve0 of BeanLusd pool
     if (event.params.from.toHexString() == beanlusdPairAddress.toHexString() && event.params.to.toHexString() !== ADDRESS_ZERO){ 
     let pool = getPool(beanlusdPairAddress, timestamp)
     pool.reserve0 = pool.reserve0.minus(reserve0)
     pool.token0 = event.address.toHex()
     pool.save()
     let pair = Pair.load(beanlusdPairAddress.toHex())
     if (pair == null) pair = initializePair(beanlusdPairAddress)
     pair.reserve0 = pool.reserve0
     pair.save()
     updatePoolData(timestamp, pool)
     getLiquidity(beanlusdPairAddress, timestamp, pool)
     }
  }
  // Increase reserve1 of BeanLusd pool
  if (event.address.toHexString() == lusdAddress.toHexString() && event.params.from.toHexString() !== ADDRESS_ZERO){
  let reserve1 = convertTokenToDecimal(event.params.value, BI_18)
     if (event.params.to.toHexString() == beanlusdPairAddress.toHexString()){
     let pool = getPool(beanlusdPairAddress, timestamp)  
     pool.reserve1 = pool.reserve1.plus(reserve1)
     pool.token1 = event.address.toHex()
     pool.save()
     let pair = Pair.load(beanlusdPairAddress.toHex())
     if (pair == null) pair = initializePair(beanlusdPairAddress)
     pair.reserve1 = pool.reserve1
     pair.save()
     updatePoolData(timestamp, pool)
     getLiquidity(beanlusdPairAddress, timestamp, pool)
     }
  }
  // Decrease reserve1 of BeanLusd pool
if (event.address.toHexString() == lusdAddress.toHexString() && event.params.to.toHexString() !== ADDRESS_ZERO){
  let reserve1 = convertTokenToDecimal(event.params.value, BI_18)
     if (event.params.from.toHexString() == beanlusdPairAddress.toHexString()){
      let pool = getPool(beanlusdPairAddress, timestamp)  
     pool.reserve1 = pool.reserve1.minus(reserve1)
     pool.token1 = event.address.toHex()
     pool.save()
     let pair = Pair.load(beanlusdPairAddress.toHex())
     if (pair == null) pair = initializePair(beanlusdPairAddress)
     pair.reserve1 = pool.reserve1
     pair.save()
     updatePoolData(timestamp, pool)
     getLiquidity(beanlusdPairAddress, timestamp, pool)
     }
  }

//Calculate LUSD3CRV price to have BEANLUSD price => not used actually
if (event.address.toHexString() == lusdAddress.toHexString() && 
    event.params.to.toHexString() == lusd3crvAddress.toHexString() && 
    event.params.from.toHexString() !== ADDRESS_ZERO || 
    event.params.from.toHexString() == lusd3crvAddress.toHexString() && 
    event.params.to.toHexString() !== ADDRESS_ZERO){
  let pool3crv = getPool(lusd3crvAddress, timestamp)  
  pool3crv.txn = event.transaction.hash.toHexString()
  pool3crv.amount1 = convertTokenToDecimal(event.params.value, BI_18)
  pool3crv.save()
}
if (event.address.toHexString() == crv3Address.toHexString() && 
    event.params.to.toHexString() == lusd3crvAddress.toHexString() && 
    event.params.from.toHexString() == ADDRESS_ZERO || 
    event.params.from.toHexString() == lusd3crvAddress.toHexString() && 
    event.params.to.toHexString() == ADDRESS_ZERO){
  let txn1 = event.transaction.hash.toHexString()  
  let value1 = convertTokenToDecimal(event.params.value, BI_18)
  let pool3crv = getPool(lusd3crvAddress, timestamp)
if (pool3crv.txn == txn1 && pool3crv.amount1 !== ZERO_BD && value1 !== ZERO_BD && pool3crv.invariant !== ZERO_BD && pool3crv.tokensupply !== ZERO_BD){
  pool3crv.price = (value1 * (pool3crv.invariant / pool3crv.tokensupply)) / pool3crv.amount1
  pool3crv.save()
  let pool = getPool(beanlusdPairAddress, timestamp)
  if (pool.amount1 == ZERO_BD || pool.volumeBean == ZERO_BD) return
  //pool.price = (pool.amount1 * pool3crv.price).div(pool.volumeBean)
  pool.price = (pool.amount1).div(pool.volumeBean)
  let delta = (pool.reserve0.plus(pool.reserve1 * pool.price)) - (pool.reserve0) 
  getCross(event.block.timestamp, delta, dayData.id, hourData.id ,pool)
  pool.delta = (pool.reserve0.plus(pool.reserve1 * pool.price)) - (pool.reserve0) 
  pool.save()
  updatePoolData(timestamp, pool)
  }
}
}

function updatePoolData(timestamp: i32, pool : Pool): void {
  
  let timeD = (timestamp / 86400).toString()
  let timeH = (timestamp / 3600).toString()
  let timestampD = timestamp / 86400
  let timestampH = timestamp / 3600
  let dayId = pool.id.concat('-').concat(timeD)
  let hourId = pool.id.concat('-').concat(timeH)
        
  let pooldayData = getPoolDayData(dayId, timestampD, pool!)
  pooldayData.price = pool.price
  pooldayData.reserve0 = pool.reserve0
  pooldayData.reserve1 = pool.reserve1
  pooldayData.liquidity = pool.liquidity
  pooldayData.liquidityUSD = pool.liquidityUSD
  pooldayData.delta = pool.delta
  pooldayData.save()
        
  let poolhourData = getPoolHourData(hourId, timestampH, pool!)
  poolhourData.price = pool.price
  poolhourData.reserve0 = pool.reserve0
  poolhourData.reserve1 = pool.reserve1
  poolhourData.liquidity = pool.liquidity
  poolhourData.liquidityUSD = pool.liquidityUSD
  poolhourData.delta = pool.delta
  poolhourData.save()
}

function updatePoolDataVolume(timestamp: i32, pool : Pool): void {
  
  let timeD = (timestamp / 86400).toString()
  let timeH = (timestamp / 3600).toString()
  let timestampD = timestamp / 86400
  let timestampH = timestamp / 3600
  let dayId = pool.id.concat('-').concat(timeD)
  let hourId = pool.id.concat('-').concat(timeH)
        
  let pooldayData = getPoolDayData(dayId, timestampD, pool!)
  pooldayData.volumeBean = pooldayData.volumeBean.plus(pool.volumeBean)
  pooldayData.volumeUSD = pooldayData.volumeUSD.plus(pool.volumeUSD)
  pooldayData.save()
        
  let poolhourData = getPoolHourData(hourId, timestampH, pool!)
  poolhourData.volumeBean = poolhourData.volumeBean.plus(pool.volumeBean)
  poolhourData.volumeUSD = poolhourData.volumeUSD.plus(pool.volumeUSD)
  poolhourData.save()
  getTotals(timestamp)
}

function updateBeanData(timestamp: i32, bean : Bean): void {
  
  let dayId = timestamp / 86400
  let beandayData = BeanDayData.load(dayId.toString())
  if (beandayData === null) beandayData = initializeBeanDayData(dayId, bean!)
  beandayData.totalSupply = bean.totalSupply
  beandayData.totalSupplyUSD = bean.totalSupplyUSD
  beandayData.totalLiquidity = bean.totalLiquidity
  beandayData.totalLiquidityUSD = bean.totalLiquidityUSD
  beandayData.averagePrice = bean.averagePrice
  beandayData.save()

  let hourId = timestamp / 3600
  let beanhourData = BeanHourData.load(hourId.toString())
  if (beanhourData === null) beanhourData = initializeBeanHourData(hourId, bean!)
  beanhourData.totalSupply = bean.totalSupply
  beanhourData.totalSupplyUSD = bean.totalSupplyUSD
  beanhourData.totalLiquidity = bean.totalLiquidity
  beanhourData.totalLiquidityUSD = bean.totalLiquidityUSD
  beanhourData.averagePrice = bean.averagePrice
  beanhourData.save()
}

function updateBeanDataVolume(timestamp: i32, bean : Bean): void {
  
  let dayId = timestamp / 86400
  let beandayData = BeanDayData.load(dayId.toString())
  if (beandayData === null) beandayData = initializeBeanDayData(dayId, bean!)
  beandayData.totalVolume = beandayData.totalVolume.plus(bean.totalVolume)
  beandayData.totalVolumeUSD = beandayData.totalVolumeUSD.plus(bean.totalVolumeUSD)
  beandayData.save()

  let hourId = timestamp / 3600
  let beanhourData = BeanHourData.load(hourId.toString())
  if (beanhourData === null) beanhourData = initializeBeanHourData(hourId, bean!)
  beanhourData.totalVolume = beanhourData.totalVolume.plus(bean.totalVolume)
  beanhourData.totalVolumeUSD = beanhourData.totalVolumeUSD.plus(bean.totalVolumeUSD)
  beanhourData.save()
}

function getCurve(timestamp: BigInt, dayData: string, hourData: string, pool : Pool): void {
// calculate Curve pool prices, delta + cross update
if (pool.amount1 == ZERO_BD || pool.volumeBean == ZERO_BD || pool.invariant == ZERO_BD || pool.tokensupply == ZERO_BD) return
pool.price = pool.amount1 * (pool.invariant / pool.tokensupply) / pool.volumeBean
let delta = (pool.reserve0.plus(pool.reserve1)).div(BigDecimal.fromString('2')) - pool.reserve0
getCross(timestamp, delta, dayData, hourData ,pool)
pool.delta = (pool.reserve0.plus(pool.reserve1)).div(BigDecimal.fromString('2')) - pool.reserve0
pool.save()
updatePoolData(timestamp.toI32(), pool)
}

function getAveragePrice(timestamp: i32): void {
// volume weighted average price
let bean = getBean(timestamp)
if (bean.totalVolumeUSD == ZERO_BD || bean.totalVolume == ZERO_BD) return
bean.averagePrice = (bean.totalVolumeUSD).div(bean.totalVolume)
bean.save()   
updateBeanData(timestamp, bean) 
}

function getTotals(timestamp: i32): void {
// calculate Volume and Liquidity totals
let bean = getBean(timestamp)
let beanEth = getPool(beanPairAddress, timestamp)
let bean3crv = getPool(beancrv3PairAddress, timestamp)
let beanLusd = getPool(beanlusdPairAddress, timestamp)
bean.totalVolume = beanEth.volumeBean + bean3crv.volumeBean + beanLusd.volumeBean
bean.totalVolumeUSD = beanEth.volumeUSD + bean3crv.volumeUSD + beanLusd.volumeUSD
bean.totalLiquidity = beanEth.liquidity + bean3crv.liquidity + beanLusd.liquidity
bean.totalLiquidityUSD = beanEth.liquidityUSD + bean3crv.liquidityUSD + beanLusd.liquidityUSD
bean.save()
updateBeanData(timestamp, bean)
updateBeanDataVolume(timestamp, bean)
getAveragePrice(timestamp)   
}

function getLiquidity(address: Address, timestamp: i32, pool: Pool): void {
// calculate Uniswap liquidity + liquidity USD with pool/pair reserves
if (address == beanPairAddress) {
  let usdcPair = Pair.load(usdcPairAddress.toHex())
if (usdcPair == null) return
pool.liquidityUSD = (pool.reserve0 * (usdcPair.reserve0 / usdcPair.reserve1)) + (pool.reserve1 * pool.price)
if (pool.price !== ZERO_BD && pool.liquidityUSD !== ZERO_BD) pool.liquidity = pool.liquidityUSD / pool.price
pool.save()
updatePoolData(timestamp, pool)
getTotals(timestamp)
}
if (address == beancrv3PairAddress) {
if (pool.invariant == ZERO_BD || pool.tokensupply == ZERO_BD || pool.price == ZERO_BD) return
pool.liquidity = pool.reserve0 + pool.reserve1
pool.liquidityUSD = (pool.reserve1 * (pool.invariant/pool.tokensupply)) +  (pool.reserve0 * pool.price)
pool.save()
updatePoolData(timestamp, pool)
getTotals(timestamp)
}
if (address == beanlusdPairAddress) {
  if (pool.invariant == ZERO_BD || pool.tokensupply == ZERO_BD || pool.price == ZERO_BD) return
  //let pool3crv = getPool(lusd3crvAddress, timestamp)
  pool.liquidity = pool.reserve0 + pool.reserve1
  pool.liquidityUSD = (pool.reserve1) +  (pool.reserve0 * pool.price)
  pool.save()
  updatePoolData(timestamp, pool)
  getTotals(timestamp)
  }
}

function getCross(timestamp: BigInt, delta: BigDecimal, dayData: string, hourData: string, pool: Pool): void {
// calculate crosses numbers with delta crosse 0  
if (pool.lastCross == ZERO_BI) pool.lastCross = timestamp
if ((pool.delta.le(ZERO_BD) && delta.ge(ZERO_BD)) || (pool.delta.ge(ZERO_BD) && delta.le(ZERO_BD))){

  createCross(pool.totalCrosses, timestamp, pool.lastCross.toI32(), dayData, hourData, delta.ge(ZERO_BD))
  let timeD = (timestamp.toI32() / 86400).toString()
  let timeH = (timestamp.toI32() / 3600).toString()
  let timestampD = timestamp.toI32() / 86400
  let timestampH = timestamp.toI32() / 3600
  let dayId = pool.id.concat('-').concat(timeD)
  let hourId = pool.id.concat('-').concat(timeH)
  let pooldayData = getPoolDayData(dayId, timestampD, pool!)
  let poolhourData = getPoolHourData(hourId, timestampH, pool!)
  poolhourData.newCrosses = poolhourData.newCrosses + 1
  poolhourData.totalCrosses = poolhourData.totalCrosses + 1
  pooldayData.newCrosses = pooldayData.newCrosses + 1
  pooldayData.totalCrosses = pooldayData.totalCrosses + 1
  pool.totalCrosses = pool.totalCrosses + 1
  let timeSinceLastCross = timestamp.minus(pool.lastCross)
  poolhourData.totalTimeSinceCross = poolhourData.totalTimeSinceCross.plus(timeSinceLastCross)
  pooldayData.totalTimeSinceCross = pooldayData.totalTimeSinceCross.plus(timeSinceLastCross)
  pool.totalTimeSinceCross = pool.totalTimeSinceCross.plus(timeSinceLastCross)
  pool.lastCross = timestamp
  pool.save()
  poolhourData.save()
  pooldayData.save()
  }
}

function initializePair(address: Address): Pair {
  let pair = new Pair(address.toHex())
  if (address.toHexString() == beanPairAddress.toHexString()) {
    pair.decimals0 = BI_18
    pair.decimals1 = BI_6
  } else {
    pair.decimals1 = BI_18
    pair.decimals0 = BI_6
  }
  return pair
}

function getBean(timestamp: i32) : Bean {
  let bean = Bean.load(beanAddress.toHex())
  if (bean == null) return initializeBean(timestamp)
  return bean as Bean!
  }

 function initializeBean(timestamp: i32) : Bean {
  let bean = new Bean(beanAddress.toHex())
  bean.decimals = BI_6
  bean.totalSupply = ZERO_BD
  bean.totalSupplyUSD = ZERO_BD
  bean.totalVolume = ZERO_BD
  bean.totalVolumeUSD = ZERO_BD
  bean.totalLiquidity = ZERO_BD
  bean.totalLiquidityUSD = ZERO_BD
  bean.averagePrice = ZERO_BD
  return bean
}

function getPool(address: Address, timestamp: i32) : Pool {
  let pool = Pool.load(address.toHex())
  if (pool == null) return initializePool(address, timestamp)
  return pool as Pool!
  }

 function initializePool(address: Address, timestamp: i32) : Pool {
  let pool = new Pool(address.toHex())
  pool.token0 = ADDRESS_ZERO
  pool.token1 = ADDRESS_ZERO
  pool.price = ZERO_BD
  pool.reserve0 = ZERO_BD
  pool.reserve1 = ZERO_BD
  pool.liquidity = ZERO_BD
  pool.liquidityUSD = ZERO_BD
  pool.volumeBean = ZERO_BD
  pool.volumeUSD = ZERO_BD
  pool.utilisation = ZERO_BD
  pool.delta = ZERO_BD
  pool.invariant = ZERO_BD
  pool.tokensupply = ZERO_BD
  pool.amount1 = ZERO_BD
  pool.txn = ADDRESS_ZERO
  pool.lastCross = ZERO_BI
  pool.totalTimeSinceCross = ZERO_BI
  pool.startTime = timestamp
  pool.totalCrosses = 0
  return pool
}

function getBeanDayData(dayId : i32, bean : Bean) : BeanDayData {
  let beandayData = BeanDayData.load(dayId.toString())
  if (beandayData === null) beandayData = initializeBeanDayData(dayId, bean!)
  return beandayData as BeanDayData!
}

function initializeBeanDayData(dayId : i32, bean : Bean) : BeanDayData {
  let dayStartTimestamp = dayId * 86400
  let beandayData = new BeanDayData(dayId.toString())
  beandayData.bean = bean.id
  beandayData.dayTimestamp = dayStartTimestamp
  beandayData.totalSupply = bean.totalSupply
  beandayData.totalSupplyUSD = bean.totalSupplyUSD
  beandayData.totalVolume = ZERO_BD
  beandayData.totalVolumeUSD = ZERO_BD
  beandayData.totalLiquidity = bean.totalLiquidity
  beandayData.totalLiquidityUSD = bean.totalLiquidityUSD
  beandayData.averagePrice = bean.averagePrice
  return beandayData
}

function getBeanHourData(hourId: i32, bean: Bean) : BeanHourData {
  let beanhourData = BeanHourData.load(hourId.toString())
  if (beanhourData === null) beanhourData = initializeBeanHourData(hourId, bean!)
  return beanhourData as BeanHourData!
}

function initializeBeanHourData(hourId : i32, bean : Bean) : BeanHourData {
  let hourStartTimestamp = hourId * 3600
  let beanhourData = new BeanHourData(hourId.toString())
  beanhourData.bean = bean.id
  beanhourData.hourTimestamp = hourStartTimestamp
  beanhourData.totalSupply = bean.totalSupply
  beanhourData.totalSupplyUSD = bean.totalSupplyUSD
  beanhourData.totalVolume = ZERO_BD
  beanhourData.totalVolumeUSD = ZERO_BD
  beanhourData.totalLiquidity = bean.totalLiquidity
  beanhourData.totalLiquidityUSD = bean.totalLiquidityUSD
  beanhourData.averagePrice = bean.averagePrice
  return beanhourData
}

function getPoolDayData(dayId : string, timestampD: i32, pool : Pool) : PoolDayData {
  let poolDayData = PoolDayData.load(dayId.toString())
  if (poolDayData === null) poolDayData = initializePoolDayData(dayId, timestampD, pool!)
  return poolDayData as PoolDayData!
}
      
function initializePoolDayData(dayId : string, timestampD: i32, pool : Pool) : PoolDayData {
  let dayStartTimestamp = timestampD * 86400
  let pooldayData = new PoolDayData(dayId.toString())
  pooldayData.pool = pool.id
  pooldayData.dayTimestamp = dayStartTimestamp
  pooldayData.reserve0 = pool.reserve0
  pooldayData.reserve1 = pool.reserve1
  pooldayData.liquidity = pool.liquidity
  pooldayData.liquidityUSD = pool.liquidityUSD
  pooldayData.volumeBean = ZERO_BD
  pooldayData.volumeUSD = ZERO_BD
  pooldayData.utilisation = pool.utilisation
  pooldayData.price = pool.price
  pooldayData.delta = pool.delta
  pooldayData.invariant = pool.invariant
  pooldayData.tokensupply = pool.tokensupply
  pooldayData.amount1 = pool.amount1
  pooldayData.newCrosses = 0
  pooldayData.totalCrosses = pool.totalCrosses
  pooldayData.totalTimeSinceCross = pool.totalTimeSinceCross
  return pooldayData
}
      
function getPoolHourData(hourId : string, timestampH: i32, pool : Pool) : PoolHourData {
  let poolHourData = PoolHourData.load(hourId.toString())
  if (poolHourData === null) poolHourData = initializePoolHourData(hourId, timestampH, pool!)
  return poolHourData as PoolHourData!
}
      
function initializePoolHourData(hourId : string, timestampH: i32, pool : Pool) : PoolHourData {
  let hourStartTimestamp = timestampH * 3600
  let poolhourData = new PoolHourData(hourId.toString())
  poolhourData.pool = pool.id
  poolhourData.hourTimestamp = hourStartTimestamp
  poolhourData.reserve0 = pool.reserve0
  poolhourData.reserve1 = pool.reserve1
  poolhourData.liquidity = pool.liquidity
  poolhourData.liquidityUSD = pool.liquidityUSD
  poolhourData.volumeBean = ZERO_BD
  poolhourData.volumeUSD = ZERO_BD
  poolhourData.utilisation = pool.utilisation
  poolhourData.price = pool.price
  poolhourData.delta = pool.delta
  poolhourData.invariant = pool.invariant
  poolhourData.tokensupply = pool.tokensupply
  poolhourData.amount1 = pool.amount1
  poolhourData.newCrosses = 0
  poolhourData.totalCrosses = pool.totalCrosses
  poolhourData.totalTimeSinceCross = pool.totalTimeSinceCross
  return poolhourData
}

function createCross(id: i32, timestamp: BigInt, lastCross: i32, dayData: string, hourData: string, crossAbove: bool): void {
  let cross = new Cross(id.toString())
  cross.timestamp = timestamp.toI32()
  cross.timeSinceLastCross = timestamp.toI32() - lastCross
  cross.above = crossAbove
  cross.pooldayData = dayData
  cross.poolhourData = hourData
  cross.save()
}

function updateDayDataWithCross(pool: Pool, pooldayData: PoolDayData, timestamp: i32): BeanDayData {
  let dayId = parseInt(pooldayData.id)
  let previousDayId = dayId - 7
  let pastDayData = BeanDayData.load((previousDayId).toString())
  if (pastDayData == null) pooldayData.averageTime7Day = getAverageTime(Price.startTime, timestamp, 0, pooldayData.totalCrosses);
  else pooldayData.averageTime7Day = getDayAverageTime(pastDayData!, pooldayData.totalCrosses, timestamp);
  previousDayId = dayId - 30
  pastDayData = BeanDayData.load((previousDayId).toString())
  if (pastDayData == null) pooldayData.averageTime30Day = getAverageTime(Price.startTime, timestamp, 0, pooldayData.totalCrosses);
  else pooldayData.averageTime30Day = getDayAverageTime(pastDayData!, pooldayData.totalCrosses, timestamp);
  return pooldayData;
}

function updateHourDataWithCross(pool: Pool, poolhourData: PoolHourData, timestamp: i32): BeanHourData {
  let hourId = parseInt(poolhourData.id)
  let previousHourId = hourId - 168
  let pastHourData = BeanHourData.load((previousHourId).toString())
  if (pastHourData == null) poolhourData.averageTime7Day = getAverageTime(Price.startTime, timestamp, 0, poolhourData.totalCrosses);
  else poolhourData.averageTime7Day = getHourAverageTime(pastHourData!, poolhourData.totalCrosses, timestamp);

  previousHourId = hourId - 720
  pastHourData = BeanHourData.load((previousHourId).toString())
  if (pastHourData == null) poolhourData.averageTime30Day = getAverageTime(Price.startTime, timestamp, 0, poolhourData.totalCrosses);
  else poolhourData.averageTime30Day = getHourAverageTime(pastHourData!, poolhourData.totalCrosses, timestamp);
  return poolhourData;
}

function getHourAverageTime(ph: PoolHourData, crosses: i32, timestamp: i32): i32 {
  let prevTimestamp = ph.hourTimestamp + 3600
  return getAverageTime(prevTimestamp, timestamp, ph.totalCrosses, crosses)
}

function getDayAverageTime(ph: PoolDayData, crosses: i32, timestamp: i32): i32 {
  let prevTimestamp = ph.dayTimestamp + 86400
  return getAverageTime(prevTimestamp, timestamp, ph.totalCrosses, crosses)
}

function getAverageTime(pt: i32, nt: i32, pc: i32, nc: i32): i32 {
  if (nc == pc) return 0;
  return (nt - pt) / (nc - pc);
}
