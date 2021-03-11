/**
 * Timeout in an async.
 *
 * @param {number} ms - The milliseconds to apply.
 * @returns {Promise} - The timeout promise.
 */
export function timeout (ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
