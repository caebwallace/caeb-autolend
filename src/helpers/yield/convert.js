/**
 * Constants.
 */
export const DAYS_PER_YEAR = 365.2422;
export const HOURS_PER_DAY = 24;
export const MONTHS_PER_YEAR = 12;

/**
 * Get Montlhly Percentage Yield : Convert hourly interests rate to monthly.
 *
 * @param {number} rate - The hourly rate.
 * @returns {number} - The monthly rate.
 */
export function getMPY (rate) {
    return convertHPYtoAPY(rate) / MONTHS_PER_YEAR;
}
/**
 * Convert hourly interests rate to daily.
 *
 * @param {number} rate - The hourly rate.
 * @returns {number} - The daily rate.
 */
export function getDPY (rate) {
    return rate * HOURS_PER_DAY;
}

/**
 * Convert annually interests rate to hourly.
 *
 * @param {number} rate - The annually rate.
 * @returns {number} - The hourly rate.
 */
export function convertAPYtoHPY (rate) {
    return rate / HOURS_PER_DAY / DAYS_PER_YEAR;
}

/**
 * Convert hourly interests rate to annualy.
 *
 * @param {number} rate - The hourly rate.
 * @returns {number} - The annualy rate.
 */
export function convertHPYtoAPY (rate) {
    return rate * HOURS_PER_DAY * DAYS_PER_YEAR;
}

/**
 * Apply a discount in % to an actual rate.
 *
 * @param {number} rate - The rate on which discount will be applied.
 * @param {number} discount - The discount (in %) to apply.
 * @returns {number} - The rate discounted.
 */
export function applyRateDiscount (rate, discount) {
    return rate * (1 - discount / 100);
}
