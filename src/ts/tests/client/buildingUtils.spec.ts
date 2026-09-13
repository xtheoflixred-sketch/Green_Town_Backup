import { expect } from 'chai';
import * as entities from '../../common/entities';
import { hammer, sign, placeableEntities } from '../../common/entities';
import { canInteractWithPickedEntity, resolveEditorPreviewType, createPreviewEntities } from '../../client/BuildingUtils';

describe('BuildingUtils', () => {
	it('blocks regular interaction while screwdriver tool is active', () => {
		const entity = { type: sign.type, flags: 0 };
		expect(canInteractWithPickedEntity(entity, true, true, true)).to.equal(false);
	});

	it('blocks regular interaction on other entities while screwdriver tool is active', () => {
		const entity = { type: hammer.type, flags: 0 };
		expect(canInteractWithPickedEntity(entity, true, true, true)).to.equal(false);
	});

	it('blocks regular interaction while wrench tool is active', () => {
		const entity = { type: sign.type, flags: 0 };
		expect(canInteractWithPickedEntity(entity, true, true, false, true)).to.equal(false);
	});

	it('blocks regular interaction on other entities while wrench tool is active', () => {
		const entity = { type: hammer.type, flags: 0 };
		expect(canInteractWithPickedEntity(entity, true, true, false, true)).to.equal(false);
	});

	it('resolves a multi-entity factory for preview placement', () => {
		expect(resolveEditorPreviewType({ editor: { type: 'fullBoat' } })).to.be.greaterThan(0);
	});

	it('creates a full multi-part preview for tree-like objects', () => {
		const preview = createPreviewEntities({
			editor: { type: 'tree' },
			paletteManager: {} as any,
		}, 5, 7);
		expect(preview.length).to.be.greaterThan(1);
		expect(preview.every(entity => entity && typeof entity.type === 'number' && entity.type > 0)).to.equal(true);
	});

	it('uses whole-tree factory entries for large tree placements', () => {
		const largeTreeEntries = placeableEntities.filter(item => /Large tree/.test(item.name));
		expect(largeTreeEntries.length).to.be.greaterThan(0);
		expect(largeTreeEntries.some(item => item.entity === 'tree' || item.entity === 'tree4' || item.entity === 'tree5')).to.equal(true);
		expect(largeTreeEntries.every(item => item.entity !== undefined)).to.equal(true);
	});

	it('accepts tree placement factory calls with an options object', () => {
		const created = entities.tree(0, 0, { variant: 1 } as any);
		expect(Array.isArray(created)).to.equal(true);
		expect(created.length).to.be.greaterThan(1);
	});
});
