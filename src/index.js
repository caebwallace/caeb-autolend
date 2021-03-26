import { Logger } from './helpers/logger/logger.js';
import { DEBUG_DATE } from './helpers/date/date.js';
import { CaebFTXAutoLend } from './providers/ftx.js';
import ENV from './helpers/env/env.js';
import { BANNER_DISCLAIMER, BREAKLINE } from './helpers/banner/banner.js';
import { getPackageInfos } from './helpers/package/package.js';
import { bold, cyan, gray } from 'kleur';

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
        this.log = Logger.create('[BOT]');

    }

    async start () {

        // Skip if already running
        if (this.isRunning) {
            const { updateInterval, updateErrorResetAfterCount } = this.opts;
            const expiredDate = this.isRunning + (updateInterval * updateErrorResetAfterCount);
            if (Date.now() > expiredDate) {
                this.log.warn(`Skip looks to be freezed since ${updateErrorResetAfterCount} rounds : RESET IT.`);
                this.isRunning = false;
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

        // Log complete sequence
        // this.log.debug('Complete');

        // Unset running
        this.isRunning = false;

    }

    async displayBanner () {
        const pck = await getPackageInfos();
        this.log.info(`${BREAKLINE}${BREAKLINE}`);
        this.log.info(bold(`${pck.name.toUpperCase()} v${pck.version}`));
        this.log.info(gray(`${pck.description}`));
        this.log.info(`License : ${bold(pck.license)}`);
        this.log.info(cyan(`${pck.repository.url}`));
        this.log.info(`${BREAKLINE}${BREAKLINE}`);
        BANNER_DISCLAIMER().split('\n').forEach(k => this.log.warn(bold().yellow(k)));
    }

}

// -------------------- START THE PRODUCT --------------------
(async function () {

    // Instanciate a dashboard
    const product = new CaebAutolend();

    // Display the banner
    await product.displayBanner();

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
