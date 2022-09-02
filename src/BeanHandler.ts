import { Transfer } from "../generated/Bean/Bean";
import { loadBean, loadBeanDailySnapshot, loadBeanHourlySnapshot } from "./utils/Bean";
import { ADDRESS_ZERO } from "./utils/Constants";
import { loadPool, loadPoolDailySnapshot, loadPoolHourlySnapshot } from "./utils/Pool";

export function handleTransfer(event: Transfer): void {

    let bean = loadBean()
    let beanHourly = loadBeanHourlySnapshot(event.block.timestamp)
    let beanDaily = loadBeanDailySnapshot(event.block.timestamp)

    // Check from addresses

    if (event.params.from == ADDRESS_ZERO) {
        // Beans were minted
        bean.totalSupply = bean.totalSupply.plus(event.params.value)
        bean.save()

        beanHourly.totalSupply = bean.totalSupply
        beanHourly.deltaBeans = beanHourly.deltaBeans.plus(event.params.value)
        beanHourly.save()

        beanDaily.totalSupply = bean.totalSupply
        beanDaily.deltaBeans = beanDaily.deltaBeans.plus(event.params.value)
        beanDaily.save()
    } else if (bean.pools.indexOf(event.params.from.toHexString()) !== -1) {
        // Beans transferred from an LP Pool
        let pool = loadPool(event.params.from)
        let poolHourly = loadPoolHourlySnapshot(event.params.from, event.block.timestamp)
        let poolDaily = loadPoolDailySnapshot(event.params.from, event.block.timestamp)

        bean.totalBeansInLiquidity = bean.totalBeansInLiquidity.plus(event.params.value)
        bean.save()

        beanHourly.totalBeansInLiquidity = bean.totalBeansInLiquidity
        beanHourly.hourlyBeansInLiquidity = beanHourly.hourlyBeansInLiquidity.plus(event.params.value)
        beanHourly.save()

        beanDaily.totalBeansInLiquidity = bean.totalBeansInLiquidity
        beanDaily.dailyBeansInLiquidity = beanDaily.dailyBeansInLiquidity.plus(event.params.value)
        beanDaily.save()

        pool.totalBeansInLiquidity = pool.totalBeansInLiquidity.minus(event.params.value)
        pool.save()

        poolHourly.totalBeansInLiquidity = pool.totalBeansInLiquidity
        poolHourly.hourlyBeansInLiquidity = poolHourly.hourlyBeansInLiquidity.minus(event.params.value)
        poolHourly.save()

        poolDaily.totalBeansInLiquidity = pool.totalBeansInLiquidity
        poolDaily.dailyBeansInLiquidity = poolDaily.dailyBeansInLiquidity.minus(event.params.value)
        poolDaily.save()
    }

    // Check to addresses

    if (event.params.to == ADDRESS_ZERO) {
        // Beans were burned
        bean.totalSupply = bean.totalSupply.minus(event.params.value)
        bean.save()

        beanHourly.totalSupply = bean.totalSupply
        beanHourly.deltaBeans = beanHourly.deltaBeans.minus(event.params.value)
        beanHourly.save()

        beanDaily.totalSupply = bean.totalSupply
        beanDaily.deltaBeans = beanDaily.deltaBeans.minus(event.params.value)
        beanDaily.save()
    } else if (bean.pools.indexOf(event.params.to.toHexString()) !== -1) {
        // Beans transferred to an LP Pool
        let pool = loadPool(event.params.to)
        let poolHourly = loadPoolHourlySnapshot(event.params.to, event.block.timestamp)
        let poolDaily = loadPoolDailySnapshot(event.params.to, event.block.timestamp)

        pool.totalBeansInLiquidity = pool.totalBeansInLiquidity.plus(event.params.value)
        pool.save()

        poolHourly.totalBeansInLiquidity = pool.totalBeansInLiquidity
        poolHourly.hourlyBeansInLiquidity = poolHourly.hourlyBeansInLiquidity.plus(event.params.value)
        poolHourly.save()

        poolDaily.totalBeansInLiquidity = pool.totalBeansInLiquidity
        poolDaily.dailyBeansInLiquidity = poolDaily.dailyBeansInLiquidity.plus(event.params.value)
        poolDaily.save()
    }
}
