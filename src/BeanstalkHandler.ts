import { Address } from '@graphprotocol/graph-ts'
import { Sunrise } from '../generated/Beanstalk/Beanstalk'
import { loadBean, loadBeanDailySnapshot, loadBeanHourlySnapshot } from './utils/Bean'
import { loadPoolDailySnapshot, loadPoolHourlySnapshot } from './utils/Pool'

export function handleSunrise(event: Sunrise): void {
    // Update the season for hourly and daily liquidity metrics
    let bean = loadBean()
    let hourly = loadBeanHourlySnapshot(event.block.timestamp)
    let daily = loadBeanDailySnapshot(event.block.timestamp)

    hourly.season = event.params.season.toI32()
    hourly.timestamp = event.block.timestamp
    hourly.blockNumber = event.block.number
    hourly.save()

    daily.season = event.params.season.toI32()
    daily.timestamp = event.block.timestamp
    daily.blockNumber = event.block.number
    daily.save()

    for (let i = 0; i < bean.pools.length; i++) {
        let poolHourly = loadPoolHourlySnapshot(Address.fromString(bean.pools[i]), event.block.timestamp)
        let poolDaily = loadPoolDailySnapshot(Address.fromString(bean.pools[i]), event.block.timestamp)

        poolHourly.season = event.params.season.toI32()
        poolHourly.lastUpdated = event.block.timestamp
        poolHourly.save()

        poolDaily.season = event.params.season.toI32()
        poolDaily.lastUpdated = event.block.timestamp
        poolDaily.save()
    }
}
