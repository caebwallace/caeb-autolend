import _ from 'lodash';

// TODO: MOVE STATICS TO MAIN CONFIG
const DEFAULT_VIBRATING_LIMIT = 2;
const DEFAULT_WARM_LIMIT = 5;

/**
 * Format a variation price and define the style to apply for UI.
 *
 * @exports helpers/numbers/formatVariation
 * @param {number} value - The variation to format.
 * @param {object} [limits={ vibrate: DEFAULT_VIBRATING_LIMIT, warm: DEFAULT_WARM_LIMIT }] - The limits to apply.
 * @param {object} [options={ decimals: 2, unit: '%' }] - The display options (unit can be muted).
 * @returns {object} - The value and the class.
 * @example
 * formatVariation(-1.37, { vibrate: 1, warm: 2 }, { options: { decimals: 2, unit: '%' } });
 */
export function formatVariation (value, limits = { vibrate: DEFAULT_VIBRATING_LIMIT, warm: DEFAULT_WARM_LIMIT }, options = { decimals: 2, unit: '%' }) {
    const { vibrate, warm } = limits;
    const { decimals, unit } = options;

    // Init the rawValue
    let rawValue = (value || 0).toFixed(decimals);

    // Protect against divided by zero when data is not available now
    if (rawValue === 'Infinity' || rawValue === '-Infinity' || Math.abs(value) > 5000) {
        rawValue = 0;
    }

    // Init the value to display
    const percent = `${rawValue && rawValue > 0 ? '+' : ''}${rawValue || '-- '}`;

    // Init the classStyle
    let classStyle = 'neutral';

    // Define styles
    if (Math.abs(rawValue) >= 0.01) {
        classStyle = rawValue > 0 ? 'positive' : 'negative';
        if (Math.abs(rawValue) > warm) {
            classStyle += ' warm';
        }
        else if (Math.abs(rawValue) > vibrate) {
            classStyle += ' vibrate';
        }
    }

    // Returns value
    return { value: percent, class: classStyle, unit, raw: parseFloat(rawValue) };
}

/**
 * Format a price and define the style to apply for UI.
 *
 * @exports helpers/numbers/formatPrice
 * @param {number} value - The current price to display.
 * @param {number} previous - The previous price to display changes.
 * @param {object} [options={limit: 0.1, decimals: 8}] - Options for display.
 * @returns {object} - Returns the value, the variation formated and the class style.
 * @example
 * formatPrice(100.2, 100.1, { limit: 0.1, decimals: 6 });
 */
export function formatPrice (value, previous, options = { limit: 0.1, decimals: 6 }) {
    const { limit, decimals } = options;

    // Nothing to show
    if (!value) {
        return {
            value: 0,
            class: 'neutral',
        };
    }

    // Split the value from interger and float decimals
    const [_int, _float] = (value || 0).toString().split('.');

    // Remain decimals after integers
    const remainDecimalsCount = decimals - _int.length;

    // Build final
    const finalString = parseFloat(`${_int}.${_float}`).toFixed(remainDecimalsCount);

    // Returns resulted string
    const variation = getVariation(previous, value);
    return {
        value: finalString,
        variation: formatVariation(variation).value,
        class: Math.abs(variation) > limit ? variation > 0 ? 'positive' : 'negative' : 'neutral',
    };
}

/**
 * Calculate the variation in percents between two numbers.
 *
 * @exports helpers/numbers/getVariation
 * @param {number} past - The past value to compare.
 * @param {number} now - The actual value to compare.
 * @returns {number} - The variation.
 * @example
 * getVariation(1, 2);
 */
export function getVariation (past, now) {
    past = parseFloat(past);
    now = parseFloat(now);
    return (now - past) * 100 / Math.abs(past);
}

/**
 * Round a string or a number to specified decimals.
 *
 * @exports helpers/numbers/roundTo
 * @param {number|string} n - The number to round to.
 * @param {number} decimals - The decimals to keep.
 * @returns {number} - The parsed number.
 * @example
 * roundTo('238.98', 2);
 */
export function roundTo (n, decimals = 2) {
    return parseFloat(parseFloat(n).toFixed(decimals));
}

/**
 * Round a string or a number to specified decimals and returns a string.
 *
 * @exports helpers/numbers/roundTo
 * @param {number|string} n - The number to round to.
 * @param {number} decimals - The decimals to keep.
 * @returns {string} - The parsed number in string.
 * @example
 * roundToFixed('238.98', 2);
 */
export function roundToFixed (n, decimals = 2) {
    return roundTo(n, decimals).toFixed(decimals);
}

/**
 * Scale a number from a range to another.
 *
 * @exports helpers/numbers/scale
 * @param {number} x - The number to scale.
 * @param {number} inMin - The minimum input range.
 * @param {number} inMax - The maximum input range.
 * @param {number} outMin - The minimum output range.
 * @param {number} outMax - The maximum output range.
 * @returns {number} - The ranged value.
 * @example
 * scale(1, 0, 1, 0, 100);
 */
export function scale (x, inMin, inMax, outMin, outMax) {
    return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
}

export function nz (x, y) {
    return _.isNaN(x) || _.isUndefined(x) ? y : x;
}

/**
 * Returns the count of decimals in a float.
 *
 * @exports helpers/numbers/countDecimals
 * @param {number} x - The input number.
 * @returns {number} - Count of decimals.
 */
export function countDecimals (x) {
    if (Math.floor(x) === x) return 0;
    return x.toString().split('.')[1]?.length || 0;
}

/**
 * Create a stepped array range with a start, a stop.
 *
 * @exports helpers/numbers/range
 * @param {number} start - The start of the range.
 * @param {number} stop - The end of the range.
 * @param {number} step - The value to increase at each step.
 * @returns {Array} - The ranges.
 */
export function range (start, stop, step) {
    return Array.from({ length: (stop - start) / step + 1 }, (_, i) => start + (i * step));
};
