import { Component, Input } from '@angular/core';
import { PonyInfo } from '../../../common/interfaces';
import { getTagGradient } from '../../../common/tags';

@Component({
	selector: 'pony-preview',
	templateUrl: 'pony-info.pug',
	styleUrls: ['pony-info.scss'],
})
export class PonyPreview {
	@Input() pony?: PonyInfo;
	@Input() name?: string;
	@Input() tag?: string;
	@Input() tagColor?: string;
	@Input() tagGradientStart?: string;
	@Input() tagGradientEnd?: string;
	@Input() tagGradientDirection: 'horizontal' | 'vertical' = 'horizontal';
	@Input() passive = true;
	@Input() scale = 1;
	@Input() noBackground = false;
	@Input() allowAnyTag = false;
	@Input() namePlateOffsetY = 10;
	@Input() tagOnlyNamePlateOffsetY = -1;
	get previewTagColor() {
		return this.tagColor && !(this.tag && /^sup[1-4]$/.test(this.tag)) ? this.tagColor : undefined;
	}
	get previewTagGradientStart() {
		const gradient = this.getTagGradientFor(this.tag);
		return this.tagGradientStart || (gradient && gradient.start) || (this.pony && this.pony.tagGradientStart);
	}
	get previewTagGradientEnd() {
		const gradient = this.getTagGradientFor(this.tag);
		return this.tagGradientEnd || (gradient && gradient.end) || (this.pony && this.pony.tagGradientEnd);
	}
	get previewTagGradientDirection() {
		const gradient = this.getTagGradientFor(this.tag);
		return this.tagGradientDirection || (gradient && gradient.direction) || (this.pony && this.pony.tagGradientDirection) || 'horizontal';
	}
	getTagGradientFor(tag?: string) {
		return tag ? getTagGradient(tag) : undefined;
	}
}
