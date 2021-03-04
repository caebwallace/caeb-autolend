import FTXRest from 'ftx-api-rest';
import ENV from '../helpers/env/env.js';
import { Logger } from '../helpers/logger/logger.js';
import { roundTo, countDecimals } from '@helpers/numbers/numbers.js';
import { convertHPYtoAPY, convertAPYtoHPY, applyRateDiscount } from '../helpers/yield/convert.js';

/**
 * FTX Auto lending tokens in spot.
 */
export class CaebFTXAutoLend {

    /**
     * Initiate the class.
     *
     * @param {object} _opts - The options to override.
     */
    constructor (_opts = {}) {

        // Setup defaults options
        const { FTX_API_KEY, FTX_API_SECRET, FTX_SUBACCOUNT_ID, INVEST_RATIO, APY_MIN } = ENV;
        this.opts = Object.assign({

            // FTX Account
            apiKey: FTX_API_KEY,
            apiSecret: FTX_API_SECRET,
            subaccountId: FTX_SUBACCOUNT_ID,

            // % of the total lendable amount to lend (from 0 to 1)
            lendSizeRatio: INVEST_RATIO,
            apyMin: APY_MIN,

            // Assets to ignore
            ignoreAssets: [],

            // Fiat assets
            fiatAssets: ['USD', 'USDT'],

            // Min available value in USD
            minAvailableLimitUSD: 0.1,
            lendPricePrecision: 8,

        }, _opts);

        // Local logging
        this.log = Logger.create('AUTOLEND [FTX]');

    }

    /**
     * Get an FTX wrapper.
     *
     * @returns {FTXRest} - The FTX Rest API wrapper.
     */
    api () {
        const { apiKey, apiSecret, subaccountId } = this.opts;
        return new FTXRest({
            key: apiKey,
            secret: apiSecret,
            subaccount: subaccountId,
        });
    }

    /**
     * Returns all market exchange informations.
     *
     * @returns {Array} - The markets pairs and contracts.
     */
    async getMarkets () {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: '/markets',
        });

        // Returns results
        return result;

    }

    /**
     * Returns assets balances.
     *
     * @returns {Array} - The assets balances.
     */
    async getAssetsBalances () {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: '/wallet/balances',
        });

        // Returns results
        return result;

    }

    /**
     * Returns actual rates on lending.
     *
     * @returns {Array} - The lending rates.
     */
    async getLendingRates () {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: '/spot_margin/lending_rates',
        });

        // Returns results
        return result;

    }

    /**
     * Returns actual offers on lending.
     *
     * @returns {Array} - The lending offers.
     */
    async getLendingBalances () {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: '/spot_margin/lending_info',
        });

        // Returns results
        return result;

    }

    /**
     * Returns lending history.
     *
     * @returns {Array} - The lending history.
     */
    async getLendingHistory () {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: '/spot_margin/lending_history',
        });

        // Returns results
        return result;

    }

    /**
     * Post a lending offer.
     *
     * @param {object} data - The offer to submit.
     */
    async submitLendingOffer (data) {

        // Do it (commented for now)
        try {

            const { coin, size, rate } = data;

            // Submit the offer
            await this.api().request({
                method: 'POST',
                path: '/spot_margin/offers',
                data,
            });

            // Log it
            this.log.info(`ADD LENDING -> ${size} [${coin}] (APY : ${roundTo(convertHPYtoAPY(rate) * 100)}%)`);
        }

        // Catch errors
        catch (err) {
            this.log.error(err, data);
        }
    }

    /**
     * Autolend coins.
     *
     * @param {Array} ignoreAssets - The list of assets to ignore (default: none).
     */
    async autolend (ignoreAssets = []) {

        // Get balances
        const rates = await this.getLendingRates();
        const balances = (await this.getLendingBalances()).filter(k => ignoreAssets.indexOf(k.coin) < 0);
        const history = await this.getLendingHistory();
        const markets = await this.getMarkets();

        // Get invest ratio for each call
        const { lendSizeRatio, apyMin, minAvailableLimitUSD, lendPricePrecision } = this.opts;

        // Log
        this.log.info('Ask for autolending assets...');

        // Loop over each lendable coins and post an offer
        if (balances && balances.length) {
            for (let i = 0; i < balances.length; i++) {

                // Get the balance
                const m = balances[i];

                // Get env
                const { lendable, coin, minRate, locked } = m;
                const { estimate: estimatedRate } = rates.find(k => k.coin === coin);
                const offerDiscount = ENV.APY_OFFER_DISCOUNT || 0;

                // Get asset
                const asset = this.getMarketsAsset(markets, coin);

                // Get available value to lend
                const available = lendable - locked;
                const availableUSD = available * asset.price;

                // Calculate the offer rate (take the market ones if better than our)
                const HPY = ENV.APY_MANUAL_FIXED ? convertAPYtoHPY(ENV.APY_MANUAL_FIXED / 100) : applyRateDiscount(estimatedRate, offerDiscount);
                const APY = convertHPYtoAPY(HPY);

                // Reject if above APY min
                if (!ENV.APY_MANUAL_FIXED && lendable > 0 && APY < (apyMin / 100)) {
                    this.log.warn(`APY TOO LOW [${coin}] -> ${APY * 100} < ${roundTo(apyMin)}%`, estimatedRate, offerDiscount);
                    return;
                }

                // If lendable coins and rate is acceptable : call lending
                if (availableUSD >= minAvailableLimitUSD && HPY > 0) {

                    // Limit the size to 1% of the total lendable amount
                    const size = roundTo(available * lendSizeRatio, lendPricePrecision);

                    // Build datas
                    const data = { coin, size, rate: HPY };

                    // Do it (commented for now)
                    await this.submitLendingOffer(data);

                }

                // Message if no things to lend
                else {
                    this.log.debug(`SIZE TOO LOW [${coin}] -> ${roundTo(availableUSD, lendPricePrecision)} USD < ${roundTo(minAvailableLimitUSD, lendPricePrecision)} USD`);
                }
            }

        }

        // Show a fresh list a coins
        const list = await this.getLendingBalances();
        let totalValue = 0;
        list.forEach(k => {

            // Calculate some ratios
            k.minRate = roundTo(convertHPYtoAPY(k.minRate) * 100);
            k.lockedRatio = roundTo(k.locked * 100 / k.lendable);
            k.lendedRatio = roundTo((k.locked - k.offered) * 100 / k.locked);

            // Calculate the value in USD
            const { coin } = k;
            const { price } = this.getMarketsAsset(markets, coin);
            k.value = k.locked * price;

            // Accumulate to totalValue
            totalValue += k.value;

            // Show balances
            this.log.debug(JSON.stringify(k));

        });

        // Debug history
        const pnl = [];
        let totalProfits = 0;
        history.forEach(h => {

            // Get infos
            const { coin, rate: hpy, proceeds, time } = h;
            const apy = roundTo(convertHPYtoAPY(hpy) * 100);

            // Get coin price in $ (search for market price, use 1 for fiats)
            const { price } = this.getMarketsAsset(markets, coin);

            // Calculate the value
            const amount = proceeds * price;

            // Push to PNL
            pnl.push({
                coin,
                amount,
                apy,
                time,
            });

            // increment total amount
            totalProfits += amount;

            // console.log(item, h, APY, history.length, price, profits, apy);
        });
        // this.log.debug('History', markets);

        // Log profits
        this.log.info(`Total lended : ${roundTo(totalValue, 3)} USD`);
        this.log.info(`Total profits : ${roundTo(totalProfits, 3)} USD (${roundTo(totalProfits * 100 / totalValue, 4)}%) - History : ${history.length}`);

    }

    /**
     * Search for an asset in the market.
     *
     * @param {Array} markets - The listed markets.
     * @param {string} coin - The coin to find.
     * @returns {object} - The market asset if found.
     */
    getMarketsAsset (markets, coin) {
        const { fiatAssets } = this.opts;
        if (fiatAssets.indexOf(coin) < 0) {
            const asset = markets.find(k => k.baseCurrency === coin && fiatAssets.indexOf(k.quoteCurrency) >= 0);
            asset.pricePrecision = countDecimals(asset.priceIncrement);
            return asset;
        }
        else {
            return { coin, price: 1, priceIncrement: 0.0001 };
        }
    }

}
