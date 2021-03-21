import _ from 'lodash';

/**
 * Breakline string for message.
 */
export const RL = '\n';

/**
 * Breakline string for message.
 */
export const BREAKLINE = '———————————————';

/**
 * Construction banner.
 *
 * @returns {string} - The banner message body.
 * @example
 * const message = BANNER_CONSTRUCTION();
 */
export function BANNER_CONSTRUCTION () {
    const textMaxWidth = Math.ceil(BREAKLINE.length * 2.2);
    const bannerConstruction = ' 🚧🚨🚧🚨🚧🚨🚧🚨🚧 ';
    const bannerConstructionTxt = [
        'TEST ONLY',
        'DON\'T FOLLOW',
    ];
    return [
        BREAKLINE,
        bannerConstruction,
        BREAKLINE,
        bannerConstructionTxt.map(v => _.pad(v, textMaxWidth)).join(RL),
        BREAKLINE,
        bannerConstruction,
        BREAKLINE,
        RL,
    ].join(RL);

}

/**
 * Build a disclaimer Banner to include to messages.
 *
 * @returns {string} - The banner message body.
 * @example
 * const message = BANNER_DISCLAIMER();
 */
export function BANNER_DISCLAIMER () {
    return `${BREAKLINE}${BREAKLINE}${RL}DISCLAIMER :${RL}Investing/trading in Leveraged Tokens is a risky endeavour.${RL}Do not enter into a transaction or invest using funds that are beyond your financial means.${RL}${BREAKLINE}${BREAKLINE}`;
}
