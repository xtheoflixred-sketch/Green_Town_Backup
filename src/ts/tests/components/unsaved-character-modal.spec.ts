import { expect } from 'chai';
import { getUnsavedCharacterChanges } from '../../components/shared/unsaved-character-modal/unsaved-character-modal';

describe('unsaved-character-modal', () => {
	it('includes visible and hidden character changes in the summary', () => {
		const current: any = {
			name: 'Sunny',
			desc: 'with a hat #winter',
			tag: 'oc',
			tagColor: 'ff00ff',
			tagGradientStart: '00ffff',
			tagGradientEnd: 'ff00ff',
			tagGradientDirection: 'vertical',
			site: 'discord',
			supportTag: 'friend',
			hideSupport: true,
			respawnAtSpawn: true,
			ponyInfo: { previewBackground: 'aabbcc' },
		};
		const stored: any = {
			name: 'Sun',
			desc: 'with a scarf',
			tag: 'mystic',
			tagColor: '00ff00',
			tagGradientStart: '000000',
			tagGradientEnd: 'ffffff',
			tagGradientDirection: 'horizontal',
			site: 'vk',
			supportTag: 'supporter',
			hideSupport: false,
			respawnAtSpawn: false,
			ponyInfo: { previewBackground: 'ddeeff' },
		};

		const changes = getUnsavedCharacterChanges(current, stored);

		expect(changes.some(change => change.toLowerCase().includes('name'))).to.equal(true);
		expect(changes.some(change => change.toLowerCase().includes('description'))).to.equal(true);
		expect(changes.some(change => change.toLowerCase().includes('tag'))).to.equal(true);
		expect(changes.some(change => change.toLowerCase().includes('tag color'))).to.equal(true);
		expect(changes.some(change => change.toLowerCase().includes('background'))).to.equal(true);
		expect(changes.some(change => change.toLowerCase().includes('support tag'))).to.equal(true);
	});
});
