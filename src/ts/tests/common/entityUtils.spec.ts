import '../lib';
import { expect } from 'chai';
import { entity } from '../mocks';
import { compareEntities, isNpcEntity, canOpenProfile } from '../../common/entityUtils';

describe('entityUtils [common]', () => {
	describe('isNpcEntity()', () => {
		it('detects NPC entities from the tag option', () => {
			const entityObject = { options: { tag: 'npc' } } as any;
			expect(isNpcEntity(entityObject)).equal(true);
		});

		it('detects NPC entities from the legacy isNPC flag', () => {
			const entityObject = { isNPC: true } as any;
			expect(isNpcEntity(entityObject)).equal(true);
		});

		it('does not treat regular ponies as NPCs', () => {
			const entityObject = { options: { tag: 'friend' } } as any;
			expect(isNpcEntity(entityObject)).equal(false);
		});
	});

	describe('canOpenProfile()', () => {
		it('allows opening profiles for NPC entities', () => {
			const entityObject = { options: { tag: 'npc' } } as any;
			expect(canOpenProfile(entityObject)).equal(true);
		});

		it('blocks opening profiles for hidden non-mod entities', () => {
			const entityObject = { playerState: 1 } as any;
			expect(canOpenProfile(entityObject, false)).equal(false);
		});
	});

	describe('compareEntities()', () => {
		it('compares by y position', () => {
			const a = entity(0, 0, 1);
			const b = entity(0, 0, 2);

			expect(compareEntities(a, b)).lt(0);
			expect(compareEntities(b, a)).gt(0);
		});

		it('compares by x position', () => {
			const a = entity(0, 1, 1);
			const b = entity(0, 2, 1);

			expect(compareEntities(a, b)).lt(0);
			expect(compareEntities(b, a)).gt(0);
		});

		it('compares by id', () => {
			const a = entity(1, 1, 1);
			const b = entity(2, 1, 1);

			expect(compareEntities(a, b)).gt(0);
			expect(compareEntities(b, a)).lt(0);
		});

		it('returns 0 for identical entities', () => {
			const a = entity(1, 1, 1);
			const b = entity(1, 1, 1);

			expect(compareEntities(a, b)).equal(0);
		});
	});
});
