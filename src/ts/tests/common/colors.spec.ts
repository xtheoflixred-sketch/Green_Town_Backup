import '../lib';
import { expect } from 'chai';
import {
	fillToOutline, fillToOutlineColor, getMessageColor, SYSTEM_COLOR, ADMIN_COLOR, MOD_COLOR,
	ANNOUNCEMENT_COLOR, PARTY_COLOR, WHITE, THINKING_COLOR, PARTY_THINKING_COLOR, SUPPORTER1_COLOR,
	SUPPORTER2_COLOR, SUPPORTER3_COLOR, SUPPORTER4_COLOR
} from '../../common/colors';
import { MessageType } from '../../common/interfaces';
import { getContrastTextColor, parseColorFast } from '../../common/color';
import { getTag } from '../../common/tags';

describe('colors', () => {
	describe('getTag()', () => {
		it('uses a custom tag color override without changing the tag id', () => {
			const tag = getTag('mod', '00ff00');
			expect(tag).not.undefined;
			expect(tag!.id).equals('mod');
			expect(tag!.color).equals(parseColorFast('00ff00'));
		});
	});

	describe('getContrastTextColor()', () => {
		it('uses dark text for light backgrounds', () => {
			expect(getContrastTextColor('ffffff')).equals('#222');
		});

		it('uses light text for dark backgrounds', () => {
			expect(getContrastTextColor('000000')).equals('#fff');
		});
	});

	describe('fillToOutline()', () => {
		it('returns undefined for undefined', () => {
			expect(fillToOutline(undefined)).undefined;
		});

		it('returns outline color', () => {
			expect(fillToOutline('ff0000')).equals('b30000');
		});
	});

	describe('fillToOutlineColor()', () => {
		it('returns outline color', () => {
			expect(fillToOutlineColor(0xff0000ff)).equals(0xb30000ff);
		});
	});

	describe('getMessageColor()', () => {
		it('returns correct color for each message type', () => {
			expect(getMessageColor(MessageType.System)).equals(SYSTEM_COLOR);
			expect(getMessageColor(MessageType.Admin)).equals(ADMIN_COLOR);
			expect(getMessageColor(MessageType.Mod)).equals(MOD_COLOR);
			expect(getMessageColor(MessageType.Announcement)).equals(ANNOUNCEMENT_COLOR);
			expect(getMessageColor(MessageType.Party)).equals(PARTY_COLOR);
			expect(getMessageColor(MessageType.Thinking)).equals(THINKING_COLOR);
			expect(getMessageColor(MessageType.PartyThinking)).equals(PARTY_THINKING_COLOR);
			expect(getMessageColor(MessageType.Supporter1)).equals(SUPPORTER1_COLOR);
			expect(getMessageColor(MessageType.Supporter2)).equals(SUPPORTER2_COLOR);
			expect(getMessageColor(MessageType.Supporter3)).equals(SUPPORTER3_COLOR);
			expect(getMessageColor(MessageType.Supporter4)).equals(SUPPORTER4_COLOR);
		});

		it('returns white color for other types', () => {
			expect(getMessageColor(MessageType.Chat)).equals(WHITE);
			expect(getMessageColor(999)).equals(WHITE);
		});
	});
});
