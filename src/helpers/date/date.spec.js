import { floorCandleDate, ceilCandleDate } from '@helpers/date/date';
import moment from 'moment';

describe('@helpers/date', () => {
    const windowInterval = moment.duration('PT4H').valueOf();
    const refDate = moment('2020-10-07T17:42:15+02:00');
    const refDateFloor = moment('2020-10-07T14:00:00+02:00').valueOf();
    const refDateCeil = moment('2020-10-07T18:00:00+02:00').valueOf();

    describe('floorCandleDate', () => {
        it('should exists', () => {
            expect(floorCandleDate).toBeDefined();
        });

        it(`should succeed date floored to windowInterval ${windowInterval}`, () => {
            const res = floorCandleDate(refDate, windowInterval);
            expect(res).toEqual(refDateFloor);
        });
    });

    describe('ceilCandleDate', () => {
        it('should exists', () => {
            expect(ceilCandleDate).toBeDefined();
        });

        it(`should succeed date ceiiled to windowInterval ${windowInterval}`, () => {
            const res = ceilCandleDate(refDate, windowInterval);
            expect(res).toEqual(refDateCeil);
        });
    });
});
