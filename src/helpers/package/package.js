import readjon from 'readjson';

/**
 * Parse project's package.json and returns formated datas.
 *
 * @returns {object} - The package metas.
 */
export async function getPackageInfos () {
    const pck = await readjon(process.cwd() + '/package.json');
    return pck;
}
