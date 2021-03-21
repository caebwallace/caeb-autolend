import _ from 'lodash';
import moment from 'moment';
import FTXRest from 'ftx-api-rest';
import ENV from '../helpers/env/env.js';
import { Logger } from '../helpers/logger/logger.js';
import { roundTo, countDecimals } from '@helpers/numbers/numbers.js';
import { convertHPYtoAPY, convertAPYtoHPY, applyRateDiscount } from '../helpers/yield/convert.js';
import { nz, roundToCeil } from '../helpers/numbers/numbers.js';
import { timeout } from '../helpers/utils/timeout.js';
import Table from 'cli-table';

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

            // Tolerance limit until the offer is updated to the best rate (in %)
            // -> if the current offer diverge from the market one, the offer is canceled and submited with an adjusted rate.
            renewOfferTolerance: 0.1,

            // Min available value in USD
            minAvailableLimitUSD: 0.1,
            lendPricePrecision: 8,

            // Pause after submitting offer
            pauseAfterSubmit: 5000,

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
     * @param {Array} ignoreAssets - The list of assets to ignore.
     * @returns {Array} - The lending offers.
     */
    async getLendingBalances (ignoreAssets) {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: '/spot_margin/lending_info',
        });

        // Returns results
        return result.filter(k => ignoreAssets.indexOf(k.coin) < 0);

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

            // Submit the offer
            await this.api().request({
                method: 'POST',
                path: '/spot_margin/offers',
                data,
            });

            // Log it
            const { coin, size, rate } = data;
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
        this.log.debug(`CANCEL OFFER [${coin}]`);
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
        const balances = await this.getLendingBalances(ignoreAssets);
        const markets = await this.getMarkets();

        // Get invest ratio for each call
        const { lendSizeRatio, apyMin, minAvailableLimitUSD, lendPricePrecision, renewOfferTolerance } = this.opts;

        // Loop over each lendable coins and post an offer
        let lendingOperations = 0;
        if (balances && balances.length) {
            for (let i = 0; i < balances.length; i++) {

                // Get the balance
                const m = balances[i];

                // Get env
                const { coin, lendable, locked, offered, minRate } = m;
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

                // Cancel the current offer if locked value but APY is too high compared to the actual market
                const roundOffered = roundToCeil(offered, lendPricePrecision);
                const roundLocked = roundToCeil(locked, lendPricePrecision);
                const roundOfferAPY = roundToCeil(convertHPYtoAPY(minRate) * 100, 2);
                const roundMarketAPY = roundToCeil(APY * 100, 2);
                const deltaAPY = Math.abs(roundOfferAPY - roundMarketAPY);
                // this.log.warn(`OFFER RATE ADJUST [${coin}] ?`, { roundOffered, roundLocked, roundOfferAPY, roundMarketAPY, deltaAPY });
                if (roundOfferAPY > 0 && deltaAPY > renewOfferTolerance) {

                    // Notification of intention
                    this.log.warn(`OFFER RATE ADJUST [${coin}] -> RENEW OFFER ${roundOffered} / ${roundLocked}`, {
                        roundOfferAPY,
                        roundMarketAPY,
                        deltaAPY,
                        renewOfferTolerance,
                    });

                    // Cancel the lending offer
                    await this.cancelLendingOffer(coin);

                    // Wait for execution
                    // await this.waitApiProcessing();
                    break;

                }

                // If lendable coins and rate is acceptable : call lending
                if (availableUSD >= minAvailableLimitUSD && HPY > 0) {

                    // Limit the size to 1% of the total lendable amount
                    const size = roundToCeil(available * lendSizeRatio, lendPricePrecision);

                    // Build datas
                    const data = { coin, size, rate: HPY };

                    // Do it (commented for now)
                    await this.submitLendingOffer(data);

                    // Increment operations counter
                    lendingOperations++;

                }

                // Message if no things to lend
                else {
                    this.log.debug(`SIZE TOO LOW [${coin}] -> ${roundTo(availableUSD, lendPricePrecision)} USD < ${roundTo(minAvailableLimitUSD, lendPricePrecision)} USD`);
                }

            }

        }

        // Mark a pause in order to have lending balances up to date
        // TODO : It's really not optimized, see later if I can watch when lending balances are complete.
        if (lendingOperations) {
            await this.waitApiProcessing();
        }

        // Show history
        await this.displayHistory({ ignoreAssets, lendPricePrecision, markets });

    }

    /**
     * Pause to wait for FTX Api processing request.
     */
    async waitApiProcessing () {
        const { pauseAfterSubmit } = this.opts;
        this.log.debug(`-- WAITING FOR FTX EXECUTION ${pauseAfterSubmit}ms --`);
        await timeout(pauseAfterSubmit);
    }

    /**
     * Display history in console as a table.
     *
     * @param {object} data - { ignoreAssets, lendPricePrecision, markets }.
     */
    async displayHistory (data) {

        // Get datas from params
        const { lendPricePrecision, ignoreAssets = [], markets = [] } = data;

        // Show a fresh list a coins
        const list = await this.getLendingBalances(ignoreAssets);
        let totalValue = 0;
        list.forEach(k => {

            // Calculate some ratios
            k.lendable = roundToCeil(k.lendable, lendPricePrecision);
            k.locked = roundToCeil(k.locked, lendPricePrecision);
            k.offered = roundToCeil(k.offered, lendPricePrecision);
            k.minRate = roundTo(convertHPYtoAPY(k.minRate) * 100);
            k.lockedRatio = roundTo(k.locked * 100 / k.lendable, 2) || 0;
            k.lendedRatio = roundTo((k.locked - k.offered) * 100 / k.locked, 2) || 0;

            // Calculate the value in USD
            const { price } = this.getMarketsAsset(markets, k.coin);
            k.value = k.locked * price;

            // Accumulate to totalValue
            totalValue += k.value;

        });

        // Debug history
        // const pnl = [];
        let totalProfits = 0;
        const history = await this.getLendingHistory();
        history.forEach(h => {

            // Get infos
            const { coin, rate: hpy, proceeds, time } = h;
            // const apy = roundTo(convertHPYtoAPY(hpy) * 100);

            // Get coin price in $ (search for market price, use 1 for fiats)
            const { price } = this.getMarketsAsset(markets, coin);

            // Calculate the value
            const amount = proceeds * price;

            // Push to PNL
            // pnl.push({
            //     coin,
            //     amount,
            //     apy,
            //     time,
            // });

            // increment total amount
            totalProfits += amount;

        });

        // Calculate avg profits
        const historyDuration = moment(_.first(history).time).valueOf() - moment(_.last(history).time).valueOf();
        const avgProfits = totalProfits * 1000 * 3600 * 24 / historyDuration;

        // Build the table
        const table = new Table({
            head: ['Coin', 'Lendable', 'Locked', 'Offered', 'APY(%)', 'USD'],
        });
        list.filter(k => k.lendable > 0).sort((a, b) => a.value < b.value ? 1 : -1).forEach(k => table.push([
            k.coin,
            k.lendable,
            k.locked,
            k.offered,
            k.minRate,
            roundTo(k.value, 3),
        ]));

        // Add totals
        table.push(['TOTAL VALUE', '', '', '', '', roundTo(totalValue, 3)]);
        table.push(['AVG 24H PROFITS', '', '', '', '', roundTo(avgProfits, 3)]);

        // Show the list
        table.toString().split('\n').forEach(k => this.log.debug(k));

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
