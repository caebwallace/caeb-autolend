import FTXRest from 'ftx-api-rest';
import ENV from '../helpers/env/env.js';
import { Logger } from '../helpers/logger/logger.js';
import { roundTo } from '@helpers/numbers/numbers.js';

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
     * Autolend coins.
     *
     * @param {Array} ignoreAssets - The list of assets to ignore (default: none).
     */
    async autolend (ignoreAssets = []) {

        // Get balances
        const rates = await this.getLendingRates();
        const balances = (await this.getLendingBalances()).filter(k => ignoreAssets.indexOf(k.coin) < 0);

        // Log
        this.log.info('Ask for autolending assets...');

        // Loop over each lendable coins and post an offer
        if (balances && balances.length) {
            await Promise.all(balances.map(async (m) => {

                // Get invest ratio for each call
                const { lendSizeRatio, apyMin } = this.opts;

                // Get env
                const { lendable, coin, minRate, locked } = m;
                const { estimate: estimatedRate } = rates.find(k => k.coin === coin);

                // Calculate the offer rate (take the market ones if better than our)
                const rate = Math.max(minRate, estimatedRate);

                // Reject if above APY min
                if (lendable > 0 && this.getAPY(rate) < (apyMin / 100)) {
                    this.log.warn(`APY TOO LOW [${coin}] -> ${roundTo(this.getAPY(rate) * 100)}% < ${roundTo(apyMin)}%`);
                    return;
                }

                // If lendable coins and rate is acceptable : call lending
                if (lendable > locked && rate > 0) {

                    // Limit the size to 1% of the total lendable amount
                    const size = lendable * lendSizeRatio;

                    // Build datas
                    const data = { coin, size, rate };

                    // Do it (commented for now)
                    try {

                        // Submit the offer
                        await this.api().request({
                            method: 'POST',
                            path: '/spot_margin/offers',
                            data,
                        });

                        // Log it
                        this.log.info(`ADD LENDING -> ${size} [${coin}] (APY : ${roundTo(this.getAPY(rate) * 100)}%)`);
                    }

                    // Catch errors
                    catch (err) {
                        this.log.error(err);
                    }

                }

            }));
        }

        // Show a fresh list a coins
        const list = await this.getLendingBalances();
        list.forEach(k => {
            k.minRate = roundTo(this.getAPY(k.minRate) * 100);
            k.lockedRatio = roundTo(k.locked * 100 / k.lendable);
            k.lendedRatio = roundTo((k.locked - k.offered) * 100 / k.locked);
            this.log.debug(JSON.stringify(k));
        });

    }

    /**
     * Convert hourly interests rate to daily.
     *
     * @param {number} rate - The hourly rate.
     * @returns {number} - The daily rate.
     */
    getAPD (rate) {
        return rate * 24;
    }

    /**
     * Convert hourly interests rate to annually.
     *
     * @param {number} rate - The hourly rate.
     * @returns {number} - The annually rate.
     */
    getAPY (rate) {
        return this.getAPD(rate) * 365.2422;
    }

    /**
     * Convert hourly interests rate to monthly.
     *
     * @param {number} rate - The hourly rate.
     * @returns {number} - The monthly rate.
     */
    getAPM (rate) {
        return this.getAPY(rate) / 12;
    }

}
