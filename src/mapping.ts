import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts"
import {
  UniswapV2Pair,
  Approval,
  Burn,
  Mint,
  Swap,
  Sync,
  Transfer
} from "../generated/BeanUniswapV2Pair/UniswapV2Pair"
import {
  TokenExchangeUnderlying,
  TokenExchange
} from "../generated/Bean3CRVPair/BEAN3CRV"
import {
  TokenExchange
} from "../generated/BeanLUSDPair/BEANLUSD"
import { Pair, Bean, Supply, Price, DayData, HourData, Cross } from "../generated/schema"
import { ADDRESS_ZERO, ZERO_BI, ONE_BI, ZERO_BD, ONE_BD, BI_6, BI_18, convertTokenToDecimal, exponentToBigDecimal } from "./helpers"

//tokens addresses
let beanAddress = Address.fromString('0xdc59ac4fefa32293a95889dc396682858d52e5db')
let lusdAdress = Address.fromString('0x5f98805A4E8be255a32880FDeC7F6728C6568bA0')

//3crv pools
let crv3Address = Address.fromString('0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490')
let lusd3crvAdress = Address.fromString('0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA')

//DAI-USDC-USDT curve pool
let curveAddress = Address.fromString('0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7')

//bean curve factories
let beancrv3PairAddress = Address.fromString('0x3a70DfA7d2262988064A2D051dd47521E43c9BdD')
let beanlusdPairAddress = Address.fromString('0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D')

//uniswap pairs
let beanPairAddress = Address.fromString('0x87898263b6c5babe34b4ec53f22d98430b91e371')
let usdcPairAddress = Address.fromString('0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc')
let usdtPairAddress = Address.fromString('0x0d4a11d5eeaac28ec3f61d100daf4d40471f1852')
let daiusdcPairAddress = Address.fromString('0xae461ca67b15dc8dc81ce7615e0320da1a9ab8d5')

export function handleApproval(event: Approval): void {}

export function handleBurn(event: Burn): void {}

export function handleMint(event: Mint): void {}

export function handleSwap(event: Swap): void {}

export function handleSync(event: Sync): void {
  let pair = Pair.load(event.address.toHex())
  if (pair == null) pair = initializePair(event.address)

  pair.reserve0 = convertTokenToDecimal(event.params.reserve0, pair.decimals0)
  pair.reserve1 = convertTokenToDecimal(event.params.reserve1, pair.decimals1)

  pair.save()

  let beanPair = Pair.load(beanPairAddress.toHex())
  let usdcPair = Pair.load(usdcPairAddress.toHex())

  let bean = getBean(event.block.timestamp)
  if (bean.lastCross == ZERO_BI) bean.lastCross = event.block.timestamp

  if (beanPair != null && usdcPair != null) {

    let timestamp = event.block.timestamp.toI32()
    let dayId = timestamp / 86400
    let dayData = getDayData(dayId, bean!)

    let hourId = timestamp / 3600
    let hourData = getHourData(hourId, bean!)
    let price = beanPair.reserve0 / beanPair.reserve1 * usdcPair.reserve0 / usdcPair.reserve1

    bean.uniswapLPUSD = (beanPair.reserve1 * price) + (beanPair.reserve0 * usdcPair.reserve0 / usdcPair.reserve1)
    dayData.uniswapLPUSD = bean.uniswapLPUSD
    hourData.uniswapLPUSD = bean.uniswapLPUSD

    if ((bean.price.le(ONE_BD) && price.ge(ONE_BD)) ||
        (bean.price.ge(ONE_BD) && price.le(ONE_BD))) {

        let timestamp = event.block.timestamp.toI32()

        createCross(bean.totalCrosses, timestamp, bean.lastCross.toI32(), dayData.id, hourData.id, price.ge(ONE_BD))
        // dayData = updateDayDataWithCross(bean!, dayData, timestamp)
        // hourData = updateHourDataWithCross(bean!, hourData!, timestamp)
        
        hourData.newCrosses = hourData.newCrosses + 1
        hourData.totalCrosses = hourData.totalCrosses + 1

        dayData.newCrosses = dayData.newCrosses + 1
        dayData.totalCrosses = dayData.totalCrosses + 1
        
        bean.totalCrosses = bean.totalCrosses + 1

        let timeSinceLastCross = event.block.timestamp.minus(bean.lastCross)
        hourData.totalTimeSinceCross = hourData.totalTimeSinceCross.plus(timeSinceLastCross)
        dayData.totalTimeSinceCross = hourData.totalTimeSinceCross.plus(timeSinceLastCross)
        bean.totalTimeSinceCross = bean.totalTimeSinceCross.plus(timeSinceLastCross)

        bean.lastCross = event.block.timestamp
    }
    bean.price = price
    bean.save()

    let priceId = event.block.timestamp.toString()
    let timestampPrice = Price.load(priceId)
    if (timestampPrice === null) {
      timestampPrice = new Price(priceId)
      timestampPrice.bean = bean.id
      timestampPrice.timestamp = event.block.timestamp
      timestampPrice.price = bean.price
    }
    timestampPrice.save()

    dayData.price = bean.price
    dayData.save()

    hourData.price = bean.price
    hourData.save()
  }

}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {

  // Bean exchange volume calculation, swap price (tokensold * price/tokenbought)
  
  let bean = getBean(event.block.timestamp)
  
  if (event.address.toHexString() == beancrv3PairAddress.toHexString()){
  
  let curveDAI = ZERO_BD
  let curveUSDT = ZERO_BD
  let curveUSDC = ZERO_BD
  let BEAN = BigInt.fromI32(0)
  let DAI = BigInt.fromI32(1)
  let USDC = BigInt.fromI32(2)
  let USDT = BigInt.fromI32(3)
  
  if (event.params.sold_id == DAI && event.params.bought_id == BEAN){
          curveDAI = convertTokenToDecimal(event.params.tokens_sold, BI_18)
          bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_bought, BI_6)
          bean.curveSwapPrice3CRV = (curveDAI * bean.curveDAIPrice).div(bean.curve3CRVVolume)
          bean.save()
          }
  if (event.params.sold_id == USDC && event.params.bought_id == BEAN){
          curveUSDC = convertTokenToDecimal(event.params.tokens_sold, BI_6)
          bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_bought, BI_6)
          bean.curveSwapPrice3CRV = (curveUSDC * bean.curveUSDCPrice).div(bean.curve3CRVVolume)
          bean.save()
          }
  if (event.params.sold_id == USDT && event.params.bought_id == BEAN){
          curveUSDT = convertTokenToDecimal(event.params.tokens_sold, BI_6)
          bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_bought, BI_6)
          bean.curveSwapPrice3CRV = (curveUSDT * bean.curveUSDTPrice).div(bean.curve3CRVVolume)
          bean.save()
          }
  
  if (event.params.sold_id == BEAN && event.params.bought_id == DAI){
          bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_sold, BI_6)
          curveDAI = convertTokenToDecimal(event.params.tokens_bought, BI_18)
          bean.curveSwapPrice3CRV = bean.curve3CRVVolume.div(curveDAI * bean.curveDAIPrice)
          bean.save()
          }
  if (event.params.sold_id == BEAN && event.params.bought_id == USDC){
          bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_sold, BI_6)
          curveUSDC = convertTokenToDecimal(event.params.tokens_bought, BI_6)
          bean.curveSwapPrice3CRV = bean.curve3CRVVolume.div(curveUSDC * bean.curveUSDCPrice)
          bean.save()
          }
  if (event.params.sold_id == BEAN && event.params.bought_id == USDT){
          bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_sold, BI_6)
          curveUSDT = convertTokenToDecimal(event.params.tokens_bought, BI_6)
          bean.curveSwapPrice3CRV = bean.curve3CRVVolume.div(curveUSDT * bean.curveUSDTPrice)
          bean.save()
          }
  
  //let bean3crv = BEAN3CRV.bind(event.address)
  //let callResult = bean3crv.try_get_virtual_price()
  //if (callResult.reverted) {
  //   log.info("get_virtual_price reverted", [])
  //} else {
  //    bean.curveVirtualPrice3CRV = convertTokenToDecimal(callResult.value, BI_18)
  //    bean.save()
  //}
  
      let timestamp = event.block.timestamp.toI32()
      let dayId = timestamp / 86400
      let hourId = timestamp / 3600
  
     let dayData = getDayData(dayId, bean!)
      dayData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
      dayData.curve3CRVLP = bean.curve3CRVLP
      dayData.curve3CRVVolume = dayData.curve3CRVVolume.plus(bean.curve3CRVVolume)
      dayData.curve3CRVVolumeUSD = dayData.curve3CRVVolume * dayData.curveSwapPrice3CRV
      dayData.curve3CRVLpUsage = dayData.curve3CRVVolume / dayData.curve3CRVLP
      dayData.save()
  
      let hourData = getHourData(hourId, bean!)
      hourData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
      hourData.curve3CRVLP = bean.curve3CRVLP
      hourData.curve3CRVVolume = hourData.curve3CRVVolume.plus(bean.curve3CRVVolume)
      hourData.curve3CRVVolumeUSD = hourData.curve3CRVVolume * hourData.curveSwapPrice3CRV
      hourData.curve3CRVLpUsage = hourData.curve3CRVVolume / hourData.curve3CRVLP
      hourData.save()
  }
  
  if (event.address.toHexString() == lusd3crvAdress.toHexString()){
  
  // LUSD/DAI-USDC-USDT swap price (tokensold * price /tokenbought)
  
  let curveLUSD = ZERO_BD
  let curveDAI = ZERO_BD
  let curveUSDT = ZERO_BD
  let curveUSDC = ZERO_BD
  let LUSD = BigInt.fromI32(0)
  let DAI = BigInt.fromI32(1)
  let USDC = BigInt.fromI32(2)
  let USDT = BigInt.fromI32(3)
  
  if (event.params.sold_id == LUSD && event.params.bought_id == DAI){
          curveLUSD = convertTokenToDecimal(event.params.tokens_sold, BI_18)
          bean.curveLUSDPrice = curveLUSD.div((convertTokenToDecimal(event.params.tokens_bought, BI_18)) * bean.curveDAIPrice)
          bean.save()
          }
  if (event.params.sold_id == LUSD && event.params.bought_id == USDT){
          curveLUSD = convertTokenToDecimal(event.params.tokens_sold, BI_18)
           bean.curveLUSDPrice = curveLUSD.div((convertTokenToDecimal(event.params.tokens_bought, BI_6)) * bean.curveUSDTPrice)
          bean.save()
          }
  if (event.params.sold_id == LUSD && event.params.bought_id == USDC){
          curveLUSD = convertTokenToDecimal(event.params.tokens_sold, BI_18)
          bean.curveLUSDPrice = curveLUSD.div((convertTokenToDecimal(event.params.tokens_bought, BI_6)) * bean.curveUSDCPrice)
          bean.save()
          }
  
  if (event.params.sold_id == DAI && event.params.bought_id == LUSD){
          curveDAI = convertTokenToDecimal(event.params.tokens_sold, BI_18)
          bean.curveLUSDPrice = (curveDAI * bean.curveDAIPrice).div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
          bean.save()
          }
  if (event.params.sold_id == USDT && event.params.bought_id == LUSD){
           curveUSDT = convertTokenToDecimal(event.params.tokens_sold, BI_6)
           bean.curveLUSDPrice = (curveUSDT * bean.curveUSDTPrice).div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
          bean.save()
          }
  if (event.params.sold_id == USDC && event.params.bought_id == LUSD){
          curveUSDC = convertTokenToDecimal(event.params.tokens_sold, BI_6)
          bean.curveLUSDPrice = (curveUSDC * bean.curveUSDCPrice).div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
          bean.save()
          }
  
     let timestamp = event.block.timestamp.toI32()
      let dayId = timestamp / 86400
      let hourId = timestamp / 3600
  
      let dayData = getDayData(dayId, bean!)
      dayData.curveLUSDPrice = bean.curveLUSDPrice
      dayData.save()
  
      let hourData = getHourData(hourId, bean!)
      hourData.curveLUSDPrice = bean.curveLUSDPrice
      hourData.save()
  }
  }
  
  export function handleTokenExchange(event: TokenExchange): void {
  
  // Bean exchange volume calculation, swap price (tokensold * price/tokenbought)
  
  let bean = getBean(event.block.timestamp)
  
  if (event.address.toHexString() == curveAddress.toHexString()){
  
  let curveDAI = ZERO_BD
  let curveUSDT = ZERO_BD
  let curveUSDC = ZERO_BD
  let DAI = BigInt.fromI32(0)
  let USDC = BigInt.fromI32(1)
  let USDT = BigInt.fromI32(2)
  let one = BigDecimal.fromString('1')
  
    if (event.params.sold_id == DAI && event.params.bought_id == USDC){
       curveDAI = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curveDAIPrice = curveDAI.div(convertTokenToDecimal(event.params.tokens_bought, BI_6))
       bean.curveUSDCPrice = one / bean.curveDAIPrice
       bean.save()
    }
    if (event.params.sold_id == DAI && event.params.bought_id == USDT){
       curveDAI = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curveDAIPrice = curveDAI.div(convertTokenToDecimal(event.params.tokens_bought, BI_6))
       bean.curveUSDTPrice = one / bean.curveDAIPrice
       bean.save()
    }
    if (event.params.sold_id == USDT && event.params.bought_id == USDC){
       curveUSDT = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curveUSDTPrice = curveUSDT.div(convertTokenToDecimal(event.params.tokens_bought, BI_6))
       bean.curveUSDCPrice = one / bean.curveUSDTPrice
       bean.save()
    }
    if (event.params.sold_id == USDC && event.params.bought_id == DAI){
       curveUSDC = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curveUSDCPrice = curveUSDC.div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
       bean.curveDAIPrice = one / bean.curveUSDCPrice
       bean.save()
    }
    if (event.params.sold_id == USDT && event.params.bought_id == DAI){
       curveUSDT = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curveUSDTPrice = curveUSDT.div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
       bean.curveDAIPrice = one / bean.curveUSDTPrice
       bean.save()
    }
    if (event.params.sold_id == USDC && event.params.bought_id == USDT){
       curveUSDC = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curveUSDCPrice = curveUSDC.div(convertTokenToDecimal(event.params.tokens_bought, BI_6))
       bean.curveUSDTPrice = one / bean.curveUSDCPrice
       bean.save()
    }
  
    let timestamp = event.block.timestamp.toI32()
    let dayId = timestamp / 86400
    let hourId = timestamp / 3600
  
    let dayData = getDayData(dayId, bean!)
    dayData.curveDAIPrice = bean.curveDAIPrice
    dayData.curveUSDTPrice = bean.curveUSDTPrice
    dayData.curveUSDCPrice = bean.curveUSDCPrice
    dayData.save()
  
    let hourData = getHourData(hourId, bean!)
    hourData.curveDAIPrice = bean.curveDAIPrice
    hourData.curveUSDTPrice = bean.curveUSDTPrice
    hourData.curveUSDCPrice = bean.curveUSDCPrice
    hourData.save()
  }
  
  if (event.address.toHexString() == beancrv3PairAddress.toHexString()){
  
  let curveDAI = ZERO_BD
  let curveUSDT = ZERO_BD
  let curveUSDC = ZERO_BD
  let BEAN = BigInt.fromI32(0)
  let DAI = BigInt.fromI32(1)
  let USDC = BigInt.fromI32(2)
  let USDT = BigInt.fromI32(3)
  
    if (event.params.sold_id == DAI && event.params.bought_id == BEAN){
       curveDAI = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_bought, BI_6)
       bean.curveSwapPrice3CRV = (curveDAI * bean.curveDAIPrice).div(bean.curve3CRVVolume)
       bean.save()
    }
    if (event.params.sold_id == USDC && event.params.bought_id == BEAN){
       curveUSDC = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_bought, BI_6)
       bean.curveSwapPrice3CRV = (curveUSDC * bean.curveUSDCPrice).div(bean.curve3CRVVolume)
       bean.save()
    }
    if (event.params.sold_id == USDT && event.params.bought_id == BEAN){
       curveUSDT = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_bought, BI_6)
       bean.curveSwapPrice3CRV = (curveUSDT * bean.curveUSDTPrice).div(bean.curve3CRVVolume)
       bean.save()
    }
    
    if (event.params.sold_id == BEAN && event.params.bought_id == DAI){
       bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       curveDAI = convertTokenToDecimal(event.params.tokens_bought, BI_18)
       bean.curveSwapPrice3CRV = bean.curve3CRVVolume.div(curveDAI * bean.curveDAIPrice)
       bean.save()
    }
    if (event.params.sold_id == BEAN && event.params.bought_id == USDC){
       bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       curveUSDC = convertTokenToDecimal(event.params.tokens_bought, BI_6)
       bean.curveSwapPrice3CRV = bean.curve3CRVVolume.div(curveUSDC * bean.curveUSDCPrice)
       bean.save()
    }
    if (event.params.sold_id == BEAN && event.params.bought_id == USDT){
       bean.curve3CRVVolume = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       curveUSDT = convertTokenToDecimal(event.params.tokens_bought, BI_6)
       bean.curveSwapPrice3CRV = bean.curve3CRVVolume.div(curveUSDT * bean.curveUSDTPrice)
       bean.save()
    }
  
  //let bean3crv = BEAN3CRV.bind(event.address)
  //let callResult = bean3crv.try_get_virtual_price()
  //if (callResult.reverted) {
  //   log.info("get_virtual_price reverted", [])
  //} else {
  //    bean.curveVirtualPrice3CRV = convertTokenToDecimal(callResult.value, BI_18)
  //    bean.save()
  //}
  
  let timestamp = event.block.timestamp.toI32()
  let dayId = timestamp / 86400
  let hourId = timestamp / 3600

  let dayData = getDayData(dayId, bean!)
  dayData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
  dayData.curve3CRVLP = bean.curve3CRVLP
  dayData.curve3CRVVolume = dayData.curve3CRVVolume.plus(bean.curve3CRVVolume)
  dayData.curve3CRVVolumeUSD = dayData.curve3CRVVolume * dayData.curveSwapPrice3CRV
  dayData.curve3CRVLpUsage = dayData.curve3CRVVolume / dayData.curve3CRVLP
  dayData.save()

  let hourData = getHourData(hourId, bean!)
  hourData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
  hourData.curve3CRVLP = bean.curve3CRVLP
  hourData.curve3CRVVolume = hourData.curve3CRVVolume.plus(bean.curve3CRVVolume)
  hourData.curve3CRVVolumeUSD = hourData.curve3CRVVolume * hourData.curveSwapPrice3CRV
  hourData.curve3CRVLpUsage = hourData.curve3CRVVolume / hourData.curve3CRVLP
  hourData.save()
  }
  
  if (event.address.toHexString() == lusd3crvAdress.toHexString()){
  
  // LUSD/DAI-USDC-USDT swap price (tokensold * price /tokenbought)
  
  let curveLUSD = ZERO_BD
  let curveDAI = ZERO_BD
  let curveUSDT = ZERO_BD
  let curveUSDC = ZERO_BD
  let LUSD = BigInt.fromI32(0)
  let DAI = BigInt.fromI32(1)
  let USDC = BigInt.fromI32(2)
  let USDT = BigInt.fromI32(3)
   
    if (event.params.sold_id == LUSD && event.params.bought_id == DAI){
       curveLUSD = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curveLUSDPrice = curveLUSD.div((convertTokenToDecimal(event.params.tokens_bought, BI_18)) * bean.curveDAIPrice)
       bean.save()
    }
    if (event.params.sold_id == LUSD && event.params.bought_id == USDT){
       curveLUSD = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curveLUSDPrice = curveLUSD.div((convertTokenToDecimal(event.params.tokens_bought, BI_6)) * bean.curveUSDTPrice)
       bean.save()
    }
    if (event.params.sold_id == LUSD && event.params.bought_id == USDC){
       curveLUSD = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curveLUSDPrice = curveLUSD.div((convertTokenToDecimal(event.params.tokens_bought, BI_6)) * bean.curveUSDCPrice)
       bean.save()
    }
    
    if (event.params.sold_id == DAI && event.params.bought_id == LUSD){
       curveDAI = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curveLUSDPrice = (curveDAI * bean.curveDAIPrice).div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
       bean.save()
    }
    if (event.params.sold_id == USDT && event.params.bought_id == LUSD){
       curveUSDT = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curveLUSDPrice = (curveUSDT * bean.curveUSDTPrice).div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
       bean.save()
    }
    if (event.params.sold_id == USDC && event.params.bought_id == LUSD){
       curveUSDC = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       bean.curveLUSDPrice = (curveUSDC * bean.curveUSDCPrice).div(convertTokenToDecimal(event.params.tokens_bought, BI_18))
       bean.save()
    }
  
    let timestamp = event.block.timestamp.toI32()
    let dayId = timestamp / 86400
    let hourId = timestamp / 3600
  
    let dayData = getDayData(dayId, bean!)
    dayData.curveLUSDPrice = bean.curveLUSDPrice
    dayData.save()
  
    let hourData = getHourData(hourId, bean!)
    hourData.curveLUSDPrice = bean.curveLUSDPrice
    hourData.save()
  }
  
  if (event.address.toHexString() == beanlusdPairAddress.toHexString()){
  
  // Bean exchange volume calculation, swap price (tokensold * LUSDPrice /tokenbought) 
  
  let curveLUSD = ZERO_BD
  let BEAN = BigInt.fromI32(0)
  let LUSD = BigInt.fromI32(1)
  
    if (event.params.sold_id == BEAN && event.params.bought_id == LUSD){
       bean.curveLUSDVolume = convertTokenToDecimal(event.params.tokens_sold, BI_6)
       curveLUSD = convertTokenToDecimal(event.params.tokens_bought, BI_18)
       bean.curveSwapPriceLUSD = bean.curveLUSDVolume.div(curveLUSD * bean.curveLUSDPrice)
       bean.save()
    }
  
    if (event.params.sold_id == LUSD && event.params.bought_id == BEAN){
       bean.curveLUSDVolume = convertTokenToDecimal(event.params.tokens_bought, BI_6)
       curveLUSD = convertTokenToDecimal(event.params.tokens_sold, BI_18)
       bean.curveSwapPriceLUSD = (curveLUSD * bean.curveLUSDPrice).div(bean.curveLUSDVolume)
       bean.save()
    }

  //let beanlusd = BEANLUSD.bind(event.address)
  //let callResult = beanlusd.try_get_virtual_price()
  //if (callResult.reverted) {
  //   log.info("get_virtual_price reverted", [])
  //} else {
  //    bean.curveVirtualPriceLUSD = convertTokenToDecimal(callResult.value, BI_18)
  //    bean.save()
  //}
  
  let timestamp = event.block.timestamp.toI32()
  let dayId = timestamp / 86400
  let hourId = timestamp / 3600
  
  let dayData = getDayData(dayId, bean!)
  dayData.curveSwapPriceLUSD = bean.curveSwapPriceLUSD
  dayData.curveLUSDLP = bean.curveLUSDLP
  dayData.curveLUSDVolume = dayData.curveLUSDVolume.plus(bean.curveLUSDVolume)
  dayData.curveLUSDVolumeUSD = dayData.curveLUSDVolume * dayData.curveSwapPriceLUSD
  dayData.curveLUSDLpUsage = dayData.curveLUSDVolume / dayData.curveLUSDLP
  dayData.save()
  
  let hourData = getHourData(hourId, bean!)
  hourData.curveSwapPriceLUSD = bean.curveSwapPriceLUSD
  hourData.curveLUSDLP = bean.curveLUSDLP
  hourData.curveLUSDVolume = hourData.curveLUSDVolume.plus(bean.curveLUSDVolume)
  hourData.curveLUSDVolumeUSD = hourData.curveLUSDVolume * hourData.curveSwapPriceLUSD
  hourData.curveLUSDLpUsage = hourData.curveLUSDVolume / hourData.curveLUSDLP
  hourData.save()
  }
  }

export function handleTransfer(event: Transfer): void {

  if(event.address.toHexString() != beanAddress.toHexString()) return

  if (event.params.from.toHexString() == ADDRESS_ZERO || event.params.to.toHexString() == ADDRESS_ZERO) {
    let bean = getBean(event.block.timestamp)

    let value = convertTokenToDecimal(event.params.value, BI_6)

    if (event.params.from.toHexString() == ADDRESS_ZERO) bean.totalSupply = bean.totalSupply.plus(value)
    else if (event.params.to.toHexString() == ADDRESS_ZERO) bean.totalSupply = bean.totalSupply.minus(value)

    bean.totalSupplyUSD = bean.totalSupply.times(bean.price)

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

    let timestamp = event.block.timestamp.toI32()

    let dayId = timestamp / 86400
    let dayData = DayData.load(dayId.toString())
    if (dayData === null) dayData = initializeDayData(dayId, bean!)
    dayData.totalSupply = bean.totalSupply
    dayData.totalSupplyUSD = bean.totalSupplyUSD
    dayData.save()

    let hourId = timestamp / 3600
    let hourData = HourData.load(hourId.toString())
    if (hourData === null) hourData = initializeHourData(hourId, bean!)
    hourData.totalSupply = bean.totalSupply
    hourData.totalSupplyUSD = bean.totalSupplyUSD
    hourData.save()
  }

  // curve metrics
  let bean = getBean(event.block.timestamp)
  let pair = Pair.load(event.address.toHex())
  if (pair == null) pair = initializePair(event.address)
  
  // LP and Reserves calculation for BEAN3CRV pool + Pair update
  
  if (event.params.from.toHexString() == ADDRESS_ZERO && event.address.toHexString() == beancrv3PairAddress.toHexString()){
     let value = convertTokenToDecimal(event.params.value, BI_18)       
     bean.curve3CRVLP = bean.curve3CRVLP.plus(value)
  }
  if (event.params.to.toHexString() == ADDRESS_ZERO && event.address.toHexString() == beancrv3PairAddress.toHexString()){
     let value = convertTokenToDecimal(event.params.value, BI_18)
     bean.curve3CRVLP = bean.curve3CRVLP.minus(value)
  }
  
  if (event.address.toHexString() == beanAddress.toHexString()){
     let reserve0 = convertTokenToDecimal(event.params.value, BI_6)
      if (event.params.to.toHexString() == beancrv3PairAddress.toHexString()) bean.curve3CRVR0 = bean.curve3CRVR0.plus(reserve0)
      if (event.params.from.toHexString() == beancrv3PairAddress.toHexString()) bean.curve3CRVR0 = bean.curve3CRVR0.minus(reserve0)
     pair.reserve0 = bean.curve3CRVR0
  }
  if (event.address.toHexString() == crv3Address.toHexString()){
     let reserve1 = convertTokenToDecimal(event.params.value, BI_18)
      if (event.params.to.toHexString() == beancrv3PairAddress.toHexString()) bean.curve3CRVR1 = bean.curve3CRVR1.plus(reserve1)
      if (event.params.from.toHexString() == beancrv3PairAddress.toHexString()) bean.curve3CRVR1 = bean.curve3CRVR1.minus(reserve1)
    pair.reserve1 = bean.curve3CRVR1
  }
  bean.save()
  
  // LP and Reserves calculation for BEANLUSD pool + pair update
  
  if (event.params.from.toHexString() == ADDRESS_ZERO && event.address.toHexString() == beanlusdPairAddress.toHexString()){
      let value = convertTokenToDecimal(event.params.value, BI_18)
      bean.curveLUSDLP = bean.curveLUSDLP.plus(value)
  }
  if (event.params.to.toHexString() == ADDRESS_ZERO && event.address.toHexString() == beanlusdPairAddress.toHexString()){
      let value = convertTokenToDecimal(event.params.value, BI_18)
      bean.curveLUSDLP = bean.curveLUSDLP.minus(value)
  }
          
  if (event.address.toHexString() == beanAddress.toHexString()){
      let reserve0 = convertTokenToDecimal(event.params.value, BI_6)
       if (event.params.to.toHexString() == beanlusdPairAddress.toHexString()) bean.curveLUSDR0 = bean.curveLUSDR0.plus(reserve0)
       if (event.params.from.toHexString() == beanlusdPairAddress.toHexString()) bean.curveLUSDR0 = bean.curveLUSDR0.minus(reserve0)
    pair.reserve0 = bean.curveLUSDR0
  }
  if (event.address.toHexString() == lusdAdress.toHexString()){
      let reserve1 = convertTokenToDecimal(event.params.value, BI_18)
       if (event.params.to.toHexString() == beanlusdPairAddress.toHexString()) bean.curveLUSDR1 = bean.curveLUSDR1.plus(reserve1)
       if (event.params.from.toHexString() == beanlusdPairAddress.toHexString()) bean.curveLUSDR1 = bean.curveLUSDR1.minus(reserve1)
    pair.reserve0 = bean.curveLUSDR1	
    }
  pair.save()
  bean.save()
  
  let timestamp = event.block.timestamp.toI32()
  let dayId = timestamp / 86400
  let hourId = timestamp / 3600
  
  let dayData = getDayData(dayId, bean!)
  dayData.curve3CRVLP = bean.curve3CRVLP
  dayData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
  dayData.curve3CRVLPUSD = dayData.curve3CRVLP * dayData.curveSwapPrice3CRV
  dayData.curveLUSDLP = bean.curveLUSDLP
  dayData.curveSwapPriceLUSD = bean.curveSwapPriceLUSD
  dayData.curveLUSDLPUSD = dayData.curveLUSDLP * dayData.curveSwapPriceLUSD
  dayData.curveTotalLPUSD = dayData.curve3CRVLPUSD + dayData.curveLUSDLPUSD
  dayData.save()
  
  let hourData = getHourData(hourId, bean!)
  hourData.curve3CRVLP = bean.curve3CRVLP
  hourData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
  hourData.curve3CRVLPUSD = hourData.curve3CRVLP * hourData.curveSwapPrice3CRV
  hourData.curveLUSDLP = bean.curveLUSDLP
  hourData.curveSwapPriceLUSD = bean.curveSwapPriceLUSD
  hourData.curveLUSDLPUSD = hourData.curveLUSDLP * hourData.curveSwapPriceLUSD
  hourData.curveTotalLPUSD = hourData.curve3CRVLPUSD + hourData.curveLUSDLPUSD
  hourData.save()
}

function initializePair(address: Address): Pair {
  let pair = new Pair(address.toHex())
  if (address.toHexString() == beanPairAddress.toHexString() || address.toHexString() == daiusdcPairAddress.toHexString()) {
    pair.decimals0 = BI_18
    pair.decimals1 = BI_6
  } else {
    pair.decimals1 = BI_18
    pair.decimals0 = BI_6
  }
  return pair
}

function getBean(timestamp: BigInt) : Bean {
  let bean = Bean.load(beanAddress.toHex())
  if (bean == null) return initializeBean(timestamp)
  return bean as Bean!
}

function initializeBean(timestamp: BigInt) : Bean {
  let bean = new Bean(beanAddress.toHex())
  bean.decimals = BI_6
  bean.lastCross = timestamp
  bean.price = ZERO_BD
  bean.totalSupply = ZERO_BD
  bean.totalSupplyUSD = ZERO_BD
  bean.totalCrosses = 0
  bean.totalTimeSinceCross = ZERO_BI
  bean.startTime = timestamp.toI32()
  bean.curveTotalLPUSD = ZERO_BD
  bean.curve3CRVLP = ZERO_BD
  bean.curveLUSDLP = ZERO_BD
  bean.curve3CRVR0 = ZERO_BD
  bean.curve3CRVR1 = ZERO_BD
  bean.curveLUSDR0 = ZERO_BD
  bean.curveLUSDR1 = ZERO_BD
  bean.curve3CRVVolume = ZERO_BD
  bean.curve3CRVVolumeUSD = ZERO_BD
  bean.curveLUSDVolume = ZERO_BD
  bean.curveLUSDVolumeUSD = ZERO_BD
  bean.curveLUSDPrice = ONE_BD
  bean.curveSwapPrice3CRV = ZERO_BD
  bean.curveSwapPriceLUSD = ZERO_BD
  bean.curveDAIPrice = ONE_BD
  bean.curveUSDCPrice = ONE_BD
  bean.curveUSDTPrice = ONE_BD
  bean.curve3CRVLPUSD = ZERO_BD
  bean.curveLUSDLPUSD = ZERO_BD
  return bean
}

function getDayData(dayId : i32, bean : Bean) : DayData {
  let dayData = DayData.load(dayId.toString())
  if (dayData === null) dayData = initializeDayData(dayId, bean!)
  return dayData as DayData!
}

function initializeDayData(dayId : i32, bean : Bean) : DayData {
  let dayStartTimestamp = dayId * 86400
  let dayData = new DayData(dayId.toString())
  dayData.bean = bean.id
  dayData.dayTimestamp = dayStartTimestamp
  dayData.totalSupply = bean.totalSupply
  dayData.totalSupplyUSD = bean.totalSupplyUSD
  dayData.price = bean.price
  dayData.newCrosses = 0
  dayData.totalCrosses = bean.totalCrosses
  dayData.totalTimeSinceCross = bean.totalTimeSinceCross
  let previousDayId = dayId - 1
  dayData.curveTotalLPUSD = bean.curveTotalLPUSD
  dayData.curve3CRVLP = bean.curve3CRVLP
  dayData.curveLUSDLP = bean.curveLUSDLP
  dayData.curve3CRVR0 = bean.curve3CRVR0
  dayData.curve3CRVR1 = bean.curve3CRVR1
  dayData.curveLUSDR0 = bean.curveLUSDR0
  dayData.curveLUSDR1 = bean.curveLUSDR1
  dayData.curve3CRVVolume = ZERO_BD
  dayData.curve3CRVVolumeUSD = bean.curve3CRVVolumeUSD
  dayData.curveLUSDVolume = ZERO_BD
  dayData.curveLUSDVolumeUSD = bean.curveLUSDVolumeUSD
  dayData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
  dayData.curveSwapPriceLUSD = bean.curveSwapPriceLUSD
  dayData.curveLUSDPrice = bean.curveLUSDPrice
  dayData.curveDAIPrice = bean.curveDAIPrice
  dayData.curveUSDCPrice = bean.curveUSDCPrice
  dayData.curveUSDTPrice = bean.curveUSDTPrice
  dayData.curve3CRVLPUSD = bean.curve3CRVLPUSD
  dayData.curveLUSDLPUSD = bean.curveLUSDLPUSD
  // let lastDayData = DayData.load(previousDayId.toString())
  // if (lastDayData != null) {
  //   lastDayData = updateDayDataWithCross(bean!, lastDayData!, dayStartTimestamp)
  //   dayData.averageTime7Day = lastDayData.averageTime7Day
  //   dayData.averageTime30Day = lastDayData.averageTime30Day
  //   lastDayData.save()
  // } else {
  //   dayData.averageTime7Day = 0
  //   dayData.averageTime30Day = 0

  // }
  return dayData
}

function getHourData(hourId: i32, bean: Bean) : HourData {
  let hourData = HourData.load(hourId.toString())
  if (hourData === null) hourData = initializeHourData(hourId, bean!)
  return hourData as HourData!
}

function initializeHourData(hourId : i32, bean : Bean) : HourData {
  let hourStartTimestamp = hourId * 3600
  let hourData = new HourData(hourId.toString())
  hourData.bean = bean.id
  hourData.hourTimestamp = hourStartTimestamp
  hourData.totalSupply = bean.totalSupply
  hourData.totalSupplyUSD = bean.totalSupplyUSD
  hourData.price = bean.price
  hourData.newCrosses = 0
  hourData.totalCrosses = bean.totalCrosses
  hourData.totalTimeSinceCross = bean.totalTimeSinceCross
  let previousHourId = hourId - 1
  hourData.curveTotalLPUSD = bean.curveTotalLPUSD
  hourData.curve3CRVLP = bean.curve3CRVLP
  hourData.curveLUSDLP = bean.curveLUSDLP
  hourData.curve3CRVR0 = bean.curve3CRVR0
  hourData.curve3CRVR1 = bean.curve3CRVR1
  hourData.curveLUSDR0 = bean.curveLUSDR0
  hourData.curveLUSDR1 = bean.curveLUSDR1
  hourData.curve3CRVVolume = ZERO_BD
  hourData.curve3CRVVolumeUSD = bean.curve3CRVVolumeUSD
  hourData.curveLUSDVolume = ZERO_BD
  hourData.curveLUSDVolumeUSD = bean.curveLUSDVolumeUSD
  hourData.curveSwapPrice3CRV = bean.curveSwapPrice3CRV
  hourData.curveSwapPriceLUSD = bean.curveSwapPriceLUSD
  hourData.curveLUSDPrice = bean.curveLUSDPrice
  hourData.curveDAIPrice = bean.curveDAIPrice
  hourData.curveUSDCPrice = bean.curveUSDCPrice
  hourData.curveUSDTPrice = bean.curveUSDTPrice
  hourData.curve3CRVLPUSD = bean.curve3CRVLPUSD
  hourData.curveLUSDLPUSD = bean.curveLUSDLPUSD
  // let lastHourData = HourData.load((previousHourId).toString())
  // if (lastHourData != null) {
  //   lastHourData = updateHourDataWithCross(bean!, lastHourData!, hourStartTimestamp)
  //   hourData.averageTime7Day = lastHourData.averageTime7Day
  //   hourData.averageTime30Day = lastHourData.averageTime30Day
  //   lastHourData.save()
  // } else {
  //   hourData.averageTime7Day = 0
  //   hourData.averageTime30Day = 0
  // }

  return hourData
}

function createCross(id: i32, timestamp: i32, lastCross: i32, dayData: string, hourData: string, crossAbove: bool): void {
  let cross = new Cross(id.toString())
  cross.timestamp = timestamp
  cross.timeSinceLastCross = timestamp - lastCross
  cross.above = crossAbove
  cross.dayData = dayData
  cross.hourData = hourData
  cross.save()
}

function updateDayDataWithCross(bean: Bean, dayData: DayData, timestamp: i32): DayData { 
  let dayId = parseInt(dayData.id)
  let previousDayId = dayId - 7
  let pastDayData = DayData.load((previousDayId).toString())
  if (pastDayData == null) dayData.averageTime7Day = getAverageTime(bean.startTime, timestamp, 0, dayData.totalCrosses);
  else dayData.averageTime7Day = getDayAverageTime(pastDayData!, dayData.totalCrosses, timestamp);
  previousDayId = dayId - 30
  pastDayData = DayData.load((previousDayId).toString())
  if (pastDayData == null) dayData.averageTime30Day = getAverageTime(bean.startTime, timestamp, 0, dayData.totalCrosses);
  else dayData.averageTime30Day = getDayAverageTime(pastDayData!, dayData.totalCrosses, timestamp);
  return dayData;
}

function updateHourDataWithCross(bean: Bean, hourData: HourData, timestamp: i32): HourData {
  let hourId = parseInt(hourData.id)
  let previousHourId = hourId - 168
  let pastHourData = HourData.load((previousHourId).toString())
  if (pastHourData == null) hourData.averageTime7Day = getAverageTime(bean.startTime, timestamp, 0, hourData.totalCrosses);
  else hourData.averageTime7Day = getHourAverageTime(pastHourData!, hourData.totalCrosses, timestamp);
  
  previousHourId = hourId - 720
  pastHourData = HourData.load((previousHourId).toString())
  if (pastHourData == null) hourData.averageTime30Day = getAverageTime(bean.startTime, timestamp, 0, hourData.totalCrosses);
  else hourData.averageTime30Day = getHourAverageTime(pastHourData!, hourData.totalCrosses, timestamp);
  return hourData;
}

function getHourAverageTime(ph: HourData, crosses: i32, timestamp: i32): i32 {
  let prevTimestamp = ph.hourTimestamp + 3600
  return getAverageTime(prevTimestamp, timestamp, ph.totalCrosses, crosses)
}

function getDayAverageTime(ph: DayData, crosses: i32, timestamp: i32): i32 {
  let prevTimestamp = ph.dayTimestamp + 86400
  return getAverageTime(prevTimestamp, timestamp, ph.totalCrosses, crosses)
}

function getAverageTime(pt: i32, nt: i32, pc: i32, nc: i32): i32 {
  if (nc == pc) return 0;
  return (nt - pt) / (nc - pc);
}
