import '../lib';
import { expect } from 'chai';
import { entity } from '../mocks';
import { compareEntities, isNpcEntity, canOpenProfile, mirrorEntity } from '../../common/entityUtils';

describe('entityUtils [common]', () => {
	describe('mirrorEntity()', () => {
		it('mirrors collider bounds and facing state for an entity', () => {
			const obj: any = {
				state: 2,
				bounds: { x: -12, y: -6, w: 24, h: 12 },
				colliders: [{ x: -4, y: -2, w: 8, h: 4, tall: true, exact: false }],
				collidersBounds: { x: -4, y: -2, w: 8, h: 4 },
				interactBounds: { x: -5, y: -5, w: 10, h: 10 },
				pickableX: 6,
				pickableY: 3,
				options: { xOffset: 4, mirror: false } as any,
			};

			mirrorEntity(obj);

			expect(obj.state & 2).equal(0);
			expect(obj.bounds.x).equal(-12);
			expect(obj.bounds.w).equal(24);
			expect(obj.colliders[0].x).equal(-4);
			expect(obj.interactBounds.x).equal(-5);
			expect(obj.pickableX).equal(-6);
			expect(obj.options.xOffset).equal(-4);
			expect(obj.options.mirror).equal(true);
		});
	});

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
