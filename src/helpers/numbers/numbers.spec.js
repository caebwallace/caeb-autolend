import { scale, roundTo } from '@helpers/numbers/numbers';

// Start tests
describe('@helpers/numbers', () => {
    describe('roundTo', () => {
        it('should exists', () => {
            expect(roundTo).toBeDefined();
        });
    });

    describe('scale', () => {
        it('should exists', () => {
            expect(scale).toBeDefined();
        });

        it('should returns 100', () => {
            const res = scale(1, 0, 1, 0, 100);
            expect(res).toEqual(100);
        });

        it('should scale 50 from [0,100] to [0,5]', () => {
            const res = scale(50, 0, 100, 0, 5);
            expect(res).toEqual(2.5);
        });

        it('should scale -75 from [100,0] to [0,5]', () => {
            const res = scale(-75, 100, 0, 0, 5);
            expect(res).toEqual(8.75);
        });

        it('should scale -75 from [100,0] to [5, 0]', () => {
            const res = scale(-75, 100, 0, 5, 0);
            expect(res).toEqual(-3.75);
        });
    });
});
