import ENV from '@helpers/env/env';

describe('@helpers/env', () => {
    describe('ENV', () => {
        it('should exists', () => {
            expect(ENV).toBeDefined();
        });

        it('should contains NODE_ENV', () => {
            expect(ENV.NODE_ENV).toBeDefined();
        });

        it('should contains MONGO_URL', () => {
            expect(ENV.MONGO_URL).toBeDefined();
        });
    });
});
