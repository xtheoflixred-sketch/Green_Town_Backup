import { Component, Input, Output, EventEmitter } from '@angular/core';
import { PonyInfo, PonyObject } from '../../../common/interfaces';
import { compressPonyString } from '../../../common/compressPony';
import { defaultPonyState } from '../../../client/ponyHelpers';
import { faSave, faRetweet, faInfoCircle } from '../../../client/icons';
import { getContrastTextColor, colorToHexRGB } from '../../../common/color';
import { getTag, getTagGradient } from '../../../common/tags';
import { getProviderIcon } from '../sign-in-box/sign-in-box';

function normalizePreviewBackground(value: string | number | boolean | undefined): string | undefined {
	const normalized = value == null ? '' : String(value).replace(/^#/, '').trim();
	if (!normalized || normalized.toLowerCase() === 'default' || normalized.toLowerCase() === '90ee90') {
		return undefined;
	}
	return normalized.toLowerCase();
}

function normalizeBoolean(value: boolean | number | string | undefined): string {
	if (value === true || value === 1 || value === 'true') return 'true';
	if (value === false || value === 0 || value === 'false') return 'false';
	return 'false';
}

function normalizePonyInfo(info?: Partial<PonyInfo>): Partial<PonyInfo> | undefined {
	if (!info) {
		return undefined;
	}
	return {
		...info,
		previewBackground: normalizePreviewBackground(info.previewBackground as any) as any,
		headTurned: !!info.headTurned,
		flip: !!info.flip,
		headTurn: info.headTurn || 0,
	};
}

export function getUnsavedCharacterChanges(current?: Partial<PonyObject>, stored?: Partial<PonyObject>): string[] {
	const changes: string[] = [];
	const addChange = (label: string, currentValue: string | number | boolean | undefined, storedValue: string | number | boolean | undefined) => {
		const currentText = currentValue == null ? '' : String(currentValue);
		const storedText = storedValue == null ? '' : String(storedValue);
		if (currentText !== storedText) {
			changes.push(label);
		}
	};

	if (!current && !stored) {
		return changes;
	}

	const currentData = current || {};
	const storedData = stored || {};

	addChange('Nickname', currentData.name, storedData.name);
	addChange('Description', currentData.desc, storedData.desc);
	addChange('Social site', currentData.site, storedData.site);
	addChange('Character tag', currentData.tag, storedData.tag);
	addChange('Tag color', currentData.tagColor, storedData.tagColor);
	addChange('Tag gradient', currentData.tagGradientStart && currentData.tagGradientEnd ? `${currentData.tagGradientStart}/${currentData.tagGradientEnd}` : undefined,
		storedData.tagGradientStart && storedData.tagGradientEnd ? `${storedData.tagGradientStart}/${storedData.tagGradientEnd}` : undefined);
	addChange('Gradient direction', currentData.tagGradientDirection, storedData.tagGradientDirection);
	addChange('Support tag', currentData.supportTag, storedData.supportTag);
	addChange('Support tag visibility', currentData.hideSupport ? 'hidden' : 'shown', storedData.hideSupport ? 'hidden' : 'shown');
	addChange('Respawn at spawn', currentData.respawnAtSpawn ? 'enabled' : 'disabled', storedData.respawnAtSpawn ? 'enabled' : 'disabled');
	addChange('Preview head turn', normalizeBoolean(currentData.ponyInfo && currentData.ponyInfo.headTurned), normalizeBoolean(storedData.ponyInfo && storedData.ponyInfo.headTurned));
	addChange('Preview flip', normalizeBoolean(currentData.ponyInfo && currentData.ponyInfo.flip), normalizeBoolean(storedData.ponyInfo && storedData.ponyInfo.flip));

	const normalCurrentInfo = normalizePonyInfo(currentData.ponyInfo);
	const normalStoredInfo = normalizePonyInfo(storedData.ponyInfo);
	const currentInfo = normalCurrentInfo ? compressPonyString(normalCurrentInfo as any) : (currentData.info || '');
	const storedInfo = normalStoredInfo ? compressPonyString(normalStoredInfo as any) : (storedData.info || '');
	if (currentInfo !== storedInfo) {
		changes.push('Character appearance');
	}

	const currentPreviewBackground = normalizePreviewBackground(currentData.ponyInfo && currentData.ponyInfo.previewBackground as any);
	const storedPreviewBackground = normalizePreviewBackground(storedData.ponyInfo && storedData.ponyInfo.previewBackground as any);
	if ((currentPreviewBackground || undefined) !== (storedPreviewBackground || undefined)) {
		changes.push('Preview background');
	}

	return Array.from(new Set(changes));
}

@Component({
	selector: 'unsaved-character-modal',
	templateUrl: 'unsaved-character-modal.pug',
	styleUrls: ['unsaved-character-modal.scss'],
})
export class UnsavedCharacterModal {
	@Input() title = 'Your character has unsaved changes.';
	@Input() prompt = 'Would you like to save your changes or discard them for the original from the server?';
	@Input() saveLabel = 'Save changes';
	@Input() discardLabel = 'Discard changes';
	@Input() ponyName?: string;
	@Input() currentPonyData?: Partial<PonyObject>;
	@Input() storedPonyData?: Partial<PonyObject>;
	@Input() currentPony?: PonyInfo;
	@Input() storedPony?: PonyInfo;
	@Output() save = new EventEmitter<void>();
	@Output() discard = new EventEmitter<void>();
	@Output() cancel = new EventEmitter<void>();

	readonly saveIcon = faSave;
	readonly discardIcon = faRetweet;
	readonly infoIcon = faInfoCircle;

	get hasVisualChanges(): boolean {
		if (!this.currentPonyData || !this.storedPonyData) {
			return !!this.currentPony || !!this.storedPony;
		}

		const currentInfo = this.currentPonyData.ponyInfo ? compressPonyString(this.currentPonyData.ponyInfo) : (this.currentPonyData.info || '');
		const storedInfo = this.storedPonyData.ponyInfo ? compressPonyString(this.storedPonyData.ponyInfo) : (this.storedPonyData.info || '');
		const currentBg = this.currentPonyData.ponyInfo ? normalizePreviewBackground(this.currentPonyData.ponyInfo.previewBackground as any) : undefined;
		const storedBg = this.storedPonyData.ponyInfo ? normalizePreviewBackground(this.storedPonyData.ponyInfo.previewBackground as any) : undefined;
		return currentInfo !== storedInfo || currentBg !== storedBg;
	}

	get shouldHidePreview(): boolean {
		return !this.hasVisualChanges && this.changes.length > 0;
	}

	get hasTextFieldComparison(): boolean {
		return !this.hasVisualChanges && this.textComparisonFields.length > 0;
	}

	get textComparisonFields(): string[] {
		const fields = new Set<string>();
		if (this.changes.includes('Nickname')) fields.add('nickname');
		if (this.changes.some(change => ['Character tag', 'Tag color', 'Tag gradient', 'Gradient direction', 'Support tag'].includes(change))) {
			fields.add('tag');
		}
		if (this.changes.includes('Social site')) fields.add('site');
		return Array.from(fields);
	}

	get showNicknameComparison(): boolean {
		return this.textComparisonFields.includes('nickname');
	}

	get showTagComparison(): boolean {
		return this.textComparisonFields.includes('tag');
	}

	get showSiteComparison(): boolean {
		return this.textComparisonFields.includes('site');
	}

	get beforePreviewName() {
		if (this.storedPonyData && this.storedPonyData.name) {
			return this.storedPonyData.name;
		}
		if (this.currentPonyData && this.currentPonyData.name) {
			return this.currentPonyData.name;
		}
		return this.ponyName;
	}

	get beforePreviewTag() {
		if (this.storedPonyData && this.storedPonyData.tag) {
			return this.storedPonyData.tag;
		}
		if (this.storedPonyData && this.storedPonyData.supportTag) {
			return this.storedPonyData.supportTag;
		}
		return undefined;
	}

	get beforePreviewSiteId() {
		return this.storedPonyData && this.storedPonyData.site ? String(this.storedPonyData.site) : undefined;
	}

	get afterPreviewSiteId() {
		return this.currentPonyData && this.currentPonyData.site ? String(this.currentPonyData.site) : undefined;
	}

	get beforePreviewSiteName() {
		const id = this.beforePreviewSiteId;
		return id ? id.charAt(0).toUpperCase() + id.slice(1) : 'No social site';
	}

	get afterPreviewSiteName() {
		const id = this.afterPreviewSiteId;
		return id ? id.charAt(0).toUpperCase() + id.slice(1) : 'No social site';
	}

	get beforePreviewSiteIcon() {
		return getProviderIcon(this.beforePreviewSiteId || '');
	}

	get afterPreviewSiteIcon() {
		return getProviderIcon(this.afterPreviewSiteId || '');
	}

	get beforePreviewTagColor() {
		return this.storedPonyData && this.storedPonyData.tagColor ? this.storedPonyData.tagColor : undefined;
	}

	private getTagBadgeBackground(tagId?: string, tagColor?: string, gradientStart?: string, gradientEnd?: string, direction: 'horizontal' | 'vertical' = 'horizontal') {
		if (gradientStart && gradientEnd) {
			return `linear-gradient(${direction === 'vertical' ? 'to bottom' : 'to right'}, #${gradientStart}, #${gradientEnd})`;
		}
		if (tagColor) {
			return `#${tagColor.replace(/^#/, '')}`;
		}
		const tag = tagId ? getTag(tagId) : undefined;
		if (tag && tag.color) {
			return `#${colorToHexRGB(tag.color)}`;
		}
		const builtInGradient = tagId ? getTagGradient(tagId) : undefined;
		if (builtInGradient) {
			return `linear-gradient(${direction === 'vertical' ? 'to bottom' : 'to right'}, #${builtInGradient.start}, #${builtInGradient.end})`;
		}
		return 'rgba(58, 183, 218, 0.9)';
	}

	private getTagBadgeTextColor(tagId?: string, tagColor?: string, gradientStart?: string, gradientEnd?: string) {
		if (tagColor) {
			return getContrastTextColor(tagColor);
		}
		const color = gradientStart && gradientEnd ? gradientStart : (tagId ? (getTag(tagId) && getTag(tagId)!.color ? colorToHexRGB(getTag(tagId)!.color) : undefined) : undefined);
		if (color) {
			return getContrastTextColor(`#${color}`);
		}
		return '#fff';
	}

	get beforePreviewTagBadgeBackground() {
		return this.getTagBadgeBackground(
			this.storedPonyData && this.storedPonyData.tag ? this.storedPonyData.tag : undefined,
			this.beforePreviewTagColor,
			this.storedPonyData && this.storedPonyData.tagGradientStart ? this.storedPonyData.tagGradientStart : undefined,
			this.storedPonyData && this.storedPonyData.tagGradientEnd ? this.storedPonyData.tagGradientEnd : undefined,
			this.storedPonyData && this.storedPonyData.tagGradientDirection ? this.storedPonyData.tagGradientDirection : 'horizontal'
		);
	}

	get afterPreviewTagBadgeBackground() {
		return this.getTagBadgeBackground(
			this.currentPonyData && this.currentPonyData.tag ? this.currentPonyData.tag : undefined,
			this.afterPreviewTagColor,
			this.currentPonyData && this.currentPonyData.tagGradientStart ? this.currentPonyData.tagGradientStart : undefined,
			this.currentPonyData && this.currentPonyData.tagGradientEnd ? this.currentPonyData.tagGradientEnd : undefined,
			this.currentPonyData && this.currentPonyData.tagGradientDirection ? this.currentPonyData.tagGradientDirection : 'horizontal'
		);
	}

	get beforePreviewTagBadgeColor() {
		return this.getTagBadgeTextColor(
			this.storedPonyData && this.storedPonyData.tag ? this.storedPonyData.tag : undefined,
			this.beforePreviewTagColor,
			this.storedPonyData && this.storedPonyData.tagGradientStart ? this.storedPonyData.tagGradientStart : undefined,
			this.storedPonyData && this.storedPonyData.tagGradientEnd ? this.storedPonyData.tagGradientEnd : undefined
		);
	}

	get afterPreviewTagBadgeColor() {
		return this.getTagBadgeTextColor(
			this.currentPonyData && this.currentPonyData.tag ? this.currentPonyData.tag : undefined,
			this.afterPreviewTagColor,
			this.currentPonyData && this.currentPonyData.tagGradientStart ? this.currentPonyData.tagGradientStart : undefined,
			this.currentPonyData && this.currentPonyData.tagGradientEnd ? this.currentPonyData.tagGradientEnd : undefined
		);
	}

	get beforePreviewTagGradientStart() {
		return this.storedPonyData && this.storedPonyData.tagGradientStart ? this.storedPonyData.tagGradientStart : undefined;
	}

	get beforePreviewTagGradientEnd() {
		return this.storedPonyData && this.storedPonyData.tagGradientEnd ? this.storedPonyData.tagGradientEnd : undefined;
	}

	get beforePreviewTagGradientDirection() {
		return this.storedPonyData && this.storedPonyData.tagGradientDirection ? this.storedPonyData.tagGradientDirection : 'horizontal';
	}

	get beforePreviewBackground() {
		const bg = this.storedPonyData && this.storedPonyData.ponyInfo
			? normalizePreviewBackground(this.storedPonyData.ponyInfo.previewBackground as any)
			: undefined;
		return bg ? `#${bg}` : undefined;
	}

	get beforePreviewTagTranslation() {
		return this.storedPonyData && (this.storedPonyData as any).tagTranslation ? (this.storedPonyData as any).tagTranslation : undefined;
	}

	get beforePreviewState() {
		const info = this.storedPonyData && this.storedPonyData.ponyInfo ? this.storedPonyData.ponyInfo : (this.currentPonyData && this.currentPonyData.ponyInfo ? this.currentPonyData.ponyInfo : undefined);
		return {
			...defaultPonyState(),
			headTurned: !!(info && info.headTurned),
			flip: !!(info && info.flip),
			headTurn: (info && info.headTurn) || 0,
		};
	}

	get afterPreviewName() {
		if (this.currentPonyData && this.currentPonyData.name) {
			return this.currentPonyData.name;
		}
		if (this.storedPonyData && this.storedPonyData.name) {
			return this.storedPonyData.name;
		}
		return this.ponyName;
	}

	get afterPreviewTag() {
		if (this.currentPonyData && this.currentPonyData.tag) {
			return this.currentPonyData.tag;
		}
		if (this.currentPonyData && this.currentPonyData.supportTag) {
			return this.currentPonyData.supportTag;
		}
		return undefined;
	}

	get afterPreviewTagColor() {
		return this.currentPonyData && this.currentPonyData.tagColor ? this.currentPonyData.tagColor : undefined;
	}

	get afterPreviewTagGradientStart() {
		return this.currentPonyData && this.currentPonyData.tagGradientStart ? this.currentPonyData.tagGradientStart : undefined;
	}

	get afterPreviewTagGradientEnd() {
		return this.currentPonyData && this.currentPonyData.tagGradientEnd ? this.currentPonyData.tagGradientEnd : undefined;
	}

	get afterPreviewTagGradientDirection() {
		return this.currentPonyData && this.currentPonyData.tagGradientDirection ? this.currentPonyData.tagGradientDirection : 'horizontal';
	}

	get afterPreviewBackground() {
		const bg = this.currentPonyData && this.currentPonyData.ponyInfo
			? normalizePreviewBackground(this.currentPonyData.ponyInfo.previewBackground as any)
			: undefined;
		return bg ? `#${bg}` : undefined;
	}

	get afterPreviewTagTranslation() {
		return this.currentPonyData && (this.currentPonyData as any).tagTranslation ? (this.currentPonyData as any).tagTranslation : undefined;
	}

	get afterPreviewState() {
		const info = this.currentPonyData && this.currentPonyData.ponyInfo ? this.currentPonyData.ponyInfo : (this.storedPonyData && this.storedPonyData.ponyInfo ? this.storedPonyData.ponyInfo : undefined);
		return {
			...defaultPonyState(),
			headTurned: !!(info && info.headTurned),
			flip: !!(info && info.flip),
			headTurn: (info && info.headTurn) || 0,
		};
	}

	get changes(): string[] {
		return getUnsavedCharacterChanges(this.currentPonyData, this.storedPonyData);
	}

	confirmSave() {
		this.save.emit();
	}

	confirmDiscard() {
		this.discard.emit();
	}

	close() {
		this.cancel.emit();
	}
}
