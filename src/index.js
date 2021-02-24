import { Logger } from './helpers/logger/logger.js';
import { DEBUG_DATE } from './helpers/date/date.js';
import { CaebFTXAutoLend } from './providers/ftx.js';
import ENV from './helpers/env/env.js';

// ----------- MAIN -------------
class CaebAutolend {

    constructor (_opts = {}) {

        // Extend options
        const { INTERVAL_CHECK_MIN, IGNORE_ASSETS } = ENV;
        this.opts = Object.assign({
            updateInterval: INTERVAL_CHECK_MIN ? INTERVAL_CHECK_MIN * 60 * 1000 : 60000,
            updateErrorResetAfterCount: 10,
            ignoreAssets: (IGNORE_ASSETS || '').split(','),
        }, _opts);

        // Local logging
        this.log = Logger.create('AUTOLEND');

    }

    async start () {

        // Skip if already running
        if (this.isRunning) {
            const { updateInterval, updateErrorResetAfterCount } = this.opts;
            if (this.isRunning > Date.now() + (updateInterval * updateErrorResetAfterCount)) {
                this.log.warn(`Skip looks to be freezed since ${updateErrorResetAfterCount} rounds : RESET IT.`);
            }
            else {
                this.log.warn(`Skip that turn, process is already running! (From: ${DEBUG_DATE(this.isRunning)})`);
                return true;
            }
        }

        // Set as running
        this.isRunning = Date.now();

        // Call operations
        const { ignoreAssets } = this.opts;
        const bot = new CaebFTXAutoLend({ ignoreAssets });
        await bot.autolend(bot.opts.ignoreAssets);

        // Log total balance
        this.log.debug('Complete');

        // Unset running
        this.isRunning = false;

    }

}

// -------------------- START THE PRODUCT --------------------
(async function () {

    // Instanciate a dashboard
    const product = new CaebAutolend();

    // Update dashboard and protects against errors to not stop the process
    const update = async () => {
        try {
            await product.start();
        }
        catch (err) {
            product.log.error(err);
            product.isRunning = false;
        }
    };

    // Ask for an update every minutes
    setInterval(async () => {
        await update();
    }, product.opts.updateInterval || 60000);

    // First update on start
    await update();

})();
