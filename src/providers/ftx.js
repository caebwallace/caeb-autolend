import _ from 'lodash';
import moment from 'moment';
import FTXRest from 'ftx-api-rest';
import { Logger } from '../helpers/logger/logger.js';
import { roundTo, countDecimals } from '@helpers/numbers/numbers.js';
import { convertHPYtoAPY, convertAPYtoHPY, applyRateDiscount } from '../helpers/yield/convert.js';
import { roundToCeil } from '../helpers/numbers/numbers.js';
import { timeout } from '../helpers/utils/timeout.js';
import Table from 'cli-table';
import readjson from 'readjson';

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

        // Read the config file
        const { account, general, assets } = readjson.sync.try(`${process.cwd()}/config/index.json`);

        // Setup defaults options
        this.opts = Object.assign({

            // FTX Account
            apiKey: account.apiKey,
            apiSecret: account.apiSecret,
            subaccountId: account.subaccountId,

            // % of the total lendable amount to lend
            genericInvestRatio: general.investRatio,
            genericApyMin: general.apyMin,
            genericDiscount: general.discount,

            // Convert Assets for better perf
            allowCoinConversion: general.allowCoinConversion === true,

            // Assets specific configuration
            assets,

            // Assets to ignore
            ignoreAssets: (Object.keys(assets) || []).filter(coin => assets[coin] && assets[coin].ignore === true),

            // Fiat assets
            fiatAssets: general.fiatAssets || ['USDT', 'USD'],

            // Tolerance limit until the offer is updated to the best rate (in %)
            // -> if the current offer diverge from the market one, the offer is canceled and submited with an adjusted rate.
            renewOfferTolerance: 0.1,

            // Min available value in USD
            minAvailableLimitUSD: 0.1,
            lendPricePrecision: 8,

            // Pause after submitting offer
            pauseAfterSubmit: 5000,

            // The version of the script
            version: '0.0.0',

        }, _opts);

        // Local logging
        this.log = Logger.create('[FTX]');

        // Wait for unlocking coin
        this.waitUnlocked = [];

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

        // Log
        this.log.info(`CONVERT REQUEST [${fromCoin}] (${size}) -> ${toCoin}`);

        // Build the request
        const { result } = await this.api().request({
            method: 'POST',
            path: '/otc/quotes',
            data: { fromCoin, toCoin, size },
        });

        // Returns results with quoteId
        return result;
    }

    /**
     * Returns informations on a convert request.
     *
     * @param {number} quoteId - The quoteId to get status.
     * @returns {object} - The response.
     */
    async convertQuoteStatus (quoteId) {

        // Build the request
        const { result } = await this.api().request({
            method: 'GET',
            path: `/otc/quotes/${quoteId}`,
        });

        // Returns results
        return result;

    }

    /**
     * Confirms a quote conversion.
     *
     * @param {number} quoteId - The quoteId to confirm.
     * @returns {object} - The response.
     */
    async convertQuoteConfirm (quoteId) {

        // Build the request
        const { result } = await this.api().request({
            method: 'POST',
            path: `/otc/quotes/${quoteId}/accept`,
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

        // Get the assets to ignore
        const { ignoreAssets } = this.opts;

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
            if (size) {
                this.log.info(`ADD LENDING [${coin}] -> ${size} (APY : ${roundTo(convertHPYtoAPY(rate) * 100)}%)`);
            }
            else {
                this.log.info(`CANCEL LENDING [${coin}] -> ${size}`);
            }

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

        // Get opts
        const { allowCoinConversion, lendPricePrecision, assets } = this.opts;

        // Skip if not activated
        if (!allowCoinConversion) {
            this.log.debug('Skip convert (general.allowCoinConversion === false)');
            return;
        }

        // Log it
        this.log.debug('Try to convert assets to a better perf one...');

        // Get the rates and the list of available balances
        const markets = await this.getMarkets();
        const rates = await this.getLendingRates();
        const balances = await this.getLendingBalances();

        // Look for each asset in balance and test if equivalent has more perf
        for (const balance of balances) {

            // Get extra balances datas
            const { coin, lendable, locked, APY, marketAPY } = this.getBalanceExtras(markets, rates, balance);
            // console.log(this.getBalanceExtras(markets, rates, balance));

            // Skip if lendable amount is null
            if (lendable > 0) {

                // Get current rate and targets one
                const balanceRate = rates.find(k => k.coin === coin);
                const targets = assets[coin] && assets[coin].convert ? assets[coin].convert : null;
                let maxRate = Object.assign({}, balanceRate);

                // Search for a better yield in targets
                if (targets && targets.length) {

                    // Find the best perf coin
                    const targetsRates = targets.map(coin => rates.find(k => k.coin === coin));
                    for (const targetRate of targetsRates) {
                        if (targetRate.estimate > maxRate.estimate) {
                            maxRate = targetRate;
                        }
                        // if (targetRate.coin === 'USDT') {
                        //     maxRate = {
                        //         coin: 'USDT',
                        //         estimate: 0.0000226017,
                        //     };
                        // }
                    }

                    // Convert it if different
                    if (coin !== maxRate.coin) {
                        try {

                            // Log it
                            this.log.info(`CONVERT [${coin}] ${lendable} (${roundToCeil(APY * 100, lendPricePrecision)}%) -> ${maxRate.coin} (${convertHPYtoAPY(maxRate.estimate * 100)}%)`);

                            // Cancel the lending offer
                            await this.cancelLendingOffer(balance.coin);

                            // Convert to the target coin
                            if (locked === 0) {

                                // Request for a quote conversion
                                const { quoteId } = await this.convertQuoteRequest(balance.coin, maxRate.coin, balance.lendable);

                                // Display status (even if we validate it just after)
                                const status = await this.convertQuoteStatus(quoteId);
                                this.log.info(`CONVERT STATUS [${coin}]`, status);

                                // Confirm the conversion
                                const results = await this.convertQuoteConfirm(quoteId);
                                this.log.info(`CONVERT [${coin}]`, results);

                                // Remove protection to enable lending after convert
                                const waitUnlockedIndex = this.waitUnlocked.indexOf(coin);
                                if (waitUnlockedIndex >= 0) {
                                    this.waitUnlocked.splice(waitUnlockedIndex, 1);
                                }

                            }

                            // Protect coin against being lended again until being unlocked
                            else if (!this.waitUnlocked.includes(coin)) {
                                this.log.warn(`CONVERT WAIT UNTIL UNLOCKED [${coin}]`);
                                this.waitUnlocked.push(coin);
                            }

                        }

                        catch (err) {
                            this.log.warn(`CONVERT ERROR [${coin}]`, err);
                        }

                    }

                    // Skip if same
                    else {
                        this.log.info(`NO CONVERT [${coin}] (${roundToCeil(marketAPY, lendPricePrecision)}%) -> Best perf compared to [${targets.join(', ')}]`);
                    }

                }
                else {
                    this.log.debug(`NO CONVERT [${coin}] -> NO TARGETS DEFINED`);
                }

            }

        }

    }

    /**
     * Autolend assets in wallet.
     */
    async autolend () {

        // Get invest ratio for each call
        const { apyMin, minAvailableLimitUSD, lendPricePrecision, renewOfferTolerance, ignoreAssets, allowCoinConversion } = this.opts;

        // Check if assets can be converted to a better performance
        if (allowCoinConversion) {
            await this.extremeLendRateConverter();
        }

        // Get balances
        const rates = await this.getLendingRates();
        const balances = await this.getLendingBalances();
        const markets = await this.getMarkets();

        // Loop over each lendable coins and post an offer
        let lendingOperations = 0;
        if (balances && balances.length) {
            for (const balance of balances) {

                // Prepare balance improved datas from inputs
                const datas = this.getBalanceExtras(markets, rates, balance);

                // Map constants
                const {
                    coin,
                    rate,
                    discount,
                    investRatio,
                    availableUSD,
                    lendableUSD,
                    HPY,
                    APY,
                    offerAPY,
                    marketAPY,
                    deltaAPY,
                } = datas;

                // Map dunamc vars
                let {
                    lendable,
                    offered,
                } = datas;

                // Reject if waiting for unlocked
                if (this.waitUnlocked.includes(coin) && lendable > 0) {
                    this.log.warn(`WAIT FOR UNLOCKED TO CONVERT [${coin}]`);
                }

                // Reject if asset is ignored
                else if (ignoreAssets.includes(coin)) {
                    this.log.warn(`IGNORING [${coin}]`);
                }

                // Reject if above APY min
                else if (lendable > 0 && APY < (apyMin / 100)) {
                    this.log.warn(`APY TOO LOW [${coin}] -> ${APY * 100} < ${roundTo(apyMin)}%`, rate, discount);
                }

                // Continue in other cases
                else {

                    // Cancel the current offer if locked value but APY is too high compared to the actual market
                    if (offerAPY > 0 && deltaAPY > renewOfferTolerance) {

                        // Notification of intention
                        this.log.warn(`OFFER RATE ADJUST [${coin}] -> RENEW OFFER`, {
                            lendable,
                            offered,
                            offerAPY,
                            marketAPY,
                            deltaAPY,
                            renewOfferTolerance,
                        });

                        // Cancel the lending offer
                        await this.cancelLendingOffer(coin);

                        // Wait for execution
                        await this.waitApiProcessing();

                        // Refresh balances for that coin
                        const freshBalance = (await this.getLendingBalances()).find(k => k.coin === coin);
                        lendable = roundToCeil(freshBalance.lendable, lendPricePrecision);
                        offered = roundToCeil(freshBalance.offered, lendPricePrecision);

                    }

                    // If lendable coins and rate is acceptable : call lending
                    if (lendableUSD >= minAvailableLimitUSD && HPY > 0 && lendable > offered) {

                        // Log
                        this.log.debug(`LENDABLE DIFF [${coin}] -> ${roundToCeil(lendable - offered, lendPricePrecision)}`);

                        // Limit the size to 1% of the total lendable amount
                        const size = roundToCeil(lendable * investRatio / 100, lendPricePrecision);

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

        }

        // Mark a pause in order to have lending balances up to date
        // TODO : It's really not optimized, see later if I can watch when lending balances are complete.
        if (lendingOperations) {
            await this.waitApiProcessing();
        }

        // Show history
        await this.displayHistory({ lendPricePrecision, markets });

    }

    /**
     * Add and format balance properties.
     *
     * @param {Array} markets - The list of all assets in market.
     * @param {Array} rates - The list of current rates.
     * @param {object} balance - The balance to fill.
     * @returns {object} - Returns improved balance.
     */
    getBalanceExtras (markets, rates, balance) {

        // Get generic opts
        const { lendPricePrecision, assets, genericDiscount, genericInvestRatio } = this.opts;

        // Get asset env
        const { coin, lendable, locked, offered, minRate } = balance;
        const { estimate: marketRate } = rates.find(k => k.coin === coin);
        const { discount, investRatio, rate } = assets[coin] || { discount: genericDiscount, investRatio: genericInvestRatio, rate: null };
        const available = roundToCeil(lendable - locked, lendPricePrecision);

        // Get asset
        const { price } = this.getMarketsAsset(markets, coin);

        // Choose the target rate
        const targetRate = rate || marketRate;

        // Returns params
        const payload = {
            coin,
            lendable: roundToCeil(lendable, lendPricePrecision),
            locked: roundToCeil(locked, lendPricePrecision),
            offered: roundToCeil(offered, lendPricePrecision),
            rate: targetRate,
            marketRate,
            discount: discount || 0,
            investRatio: investRatio || 100,
            available,
            availableUSD: available * price,
            lendableUSD: lendable * price,
            HPY: rate ? convertAPYtoHPY(rate / 100) : applyRateDiscount(targetRate, discount),
        };

        // Complete payload with extras
        payload.APY = convertHPYtoAPY(payload.HPY);
        payload.offerAPY = roundToCeil(convertHPYtoAPY(minRate) * 100, 2);
        payload.marketAPY = roundToCeil(payload.APY * 100, 2);
        payload.deltaAPY = roundToCeil(Math.abs(payload.offerAPY - payload.marketAPY), 2);

        // Returns payload generated
        return payload;

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
        const { lendPricePrecision, markets = [] } = data;

        // Show a fresh list a coins
        const list = await this.getLendingBalances();
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
            const { coin, proceeds } = h;

            // Get coin price in $ (search for market price, use 1 for fiats)
            const { price } = this.getMarketsAsset(markets, coin);

            // Calculate the value
            const amount = proceeds * price;

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
