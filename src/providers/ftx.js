import FTXRest from 'ftx-api-rest';
import ENV from '../helpers/env/env.js';
import { Logger } from '../helpers/logger/logger.js';
import { roundTo, countDecimals } from '@helpers/numbers/numbers.js';
import { convertHPYtoAPY, convertAPYtoHPY, applyRateDiscount } from '../helpers/yield/convert.js';
import { roundToCeil } from '../helpers/numbers/numbers.js';
import { timeout } from '../helpers/utils/timeout.js';

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

            // Pause after submitting offer
            pauseAfterSubmit: 2000,

        }, _opts);

        // Local logging
        this.log = Logger.create('[FTX]');

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

    /** Returns the lists of leveraged tokens.
     *
     * @returns {Array} - The assets balances.
     */
    async getLeveragedTokens () {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: '/lt/tokens',
        });

        // Returns results
        return result;

    }

    /**
     * Convert an asset to another.
     *
     * @param {string} fromCoin - The coin to convert from.
     * @param {string} toCoin - The coin to convert in.
     * @param {number} size - The qty of fromCoin to convert.
     * @returns {object} - The response.
     */
    async convertQuoteRequest (fromCoin, toCoin, size) {

        // Build the request
        const { result } = await this.api().request({
            method: 'POST',
            path: '/otc/quotes',
            data: { fromCoin, toCoin, size },
        });

        console.log(result);
    }

    /**
     * Returns informations on a convert request.
     *
     * @param {number} quoteId - The quoteId to get status.
     * @returns {object} - The response.
     */
    async converQuoteStatus (quoteId) {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: `/otc/quotes/${quoteId}`,
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
            this.log.info(`ADD LENDING [${coin}] -> ${size} (APY : ${roundTo(convertHPYtoAPY(rate) * 100)}%)`);
        }

        // Catch errors
        catch (err) {
            this.log.error(err, data);
        }
    }

    /**
     * Cancel offer on non locked assets.
     *
     * @param {object} coin - The offer to cancel.
     */
    async cancelLendingOffer (coin) {
        this.log.debug(`Cancel offer for ${coin}`);
        await this.submitLendingOffer({
            coin,
            size: 0,
            rate: 0,
        });
        await timeout(500);
    }

    /**
     * Autolend, but in extreme mode : looks for more valuable profits asset and convert all possible assets to the more rentable one in the next hour.
     * WARNING : as you can read in README.md, ABOUT BI_COLLATERAL LOSTS, you can loose money by using this feature.
     * ----------------------------------------------------------------------
     * PLEASE BE CONSCIENT THAT WE'RE NOT ALWAYS IN BULL MARKET AND TAKE CARE.
     * ----------------------------------------------------------------------
     */
    async extremeLendRateConverter () {

    }

    /**
     * Autolend assets in wallet.
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
        const { lendSizeRatio, apyMin, minAvailableLimitUSD, lendPricePrecision, pauseAfterSubmit } = this.opts;

        // Log
        this.log.debug('-- AUTO LENDING ASSETS --');

        // Loop over each lendable coins and post an offer
        if (balances && balances.length) {
            for (let i = 0; i < balances.length; i++) {

                // Get the balance
                const m = balances[i];

                // Get env
                const { lendable, coin, locked } = m;
                const { estimate: estimatedRate } = rates.find(k => k.coin === coin);
                const offerDiscount = ENV.APY_OFFER_DISCOUNT || 0;

                // Get asset
                const asset = this.getMarketsAsset(markets, coin);

                // Cancel offer for non locked assets
                // await this.cancelLendingOffer(coin);

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
                    const size = roundToCeil(available * lendSizeRatio, lendPricePrecision);

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

        // Mark a pause in order to have lending balances up to date
        this.log.debug('-- WAITING FOR FTX EXECUTION --');
        await timeout(pauseAfterSubmit);

        // Show a fresh list a coins
        this.log.debug('-- CURRENT LEND BALANCES --');
        const list = await this.getLendingBalances();
        let totalValue = 0;
        list.forEach(k => {

            // Calculate some ratios
            k.lendable = roundToCeil(k.lendable, lendPricePrecision);
            k.locked = roundToCeil(k.locked, lendPricePrecision);
            k.offered = roundToCeil(k.offered, lendPricePrecision);
            k.minRate = roundTo(convertHPYtoAPY(k.minRate) * 100);
            k.lockedRatio = roundTo(k.locked * 100 / k.lendable, 2);
            k.lendedRatio = roundTo((k.locked - k.offered) * 100 / k.locked, 2);

            // Calculate the value in USD
            const { price } = this.getMarketsAsset(markets, k.coin);
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
        this.log.debug('-- SUMMARY --');
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
