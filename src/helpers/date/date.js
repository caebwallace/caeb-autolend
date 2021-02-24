import moment from 'moment';

/**
 * Floor a datetime with a windowInterval.
 *
 * @exports helpers/date/floorCandleDate
 * @param {Date} date - The date to floor.
 * @param {number} windowInterval - Window interval in ms.
 * @returns {number} - The floored date.
 * @example
 * floorCandleDate(moment('2020-10-07T17:42:15+02:00'), moment.duration('PT4H').valueOf());
 */
export function floorCandleDate (date, windowInterval) {
    return moment(date - date % windowInterval + 1).valueOf();
}

/**
 * Ceil a datetime with a windowInterval.
 *
 * @exports helpers/date/ceilCandleDate
 * @param {Date} date - The date to ceil.
 * @param {number} windowInterval - Window interval in ms.
 * @returns {number} - The floored date.
 * @example
 * ceilCandleDate(moment('2020-10-07T17:42:15+02:00'), moment.duration('PT4H').valueOf());
 */
export function ceilCandleDate (date, windowInterval) {
    return parseInt(date) + (windowInterval - parseInt(date) % windowInterval);
}

export function DEBUG_DATE (date) {
    return moment(date).utc().format();
}

export function DISPLAY_UTC (date) {
    return moment(date).utc().format().replace('Z', '').split('T').reverse().join('  ');
}
