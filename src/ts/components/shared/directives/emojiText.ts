import { Directive, Input, OnChanges, SimpleChanges, ElementRef } from '@angular/core';
import { replaceNodes } from '../../../client/htmlUtils';

@Directive({
	selector: '[emojiText]',
})
export class EmojiText implements OnChanges {
	@Input() emojiText?: string;
	@Input() emojiScale = 2;

	constructor(private el: ElementRef) {
	}

	ngOnChanges(_changes: SimpleChanges) {
		const element = this.el.nativeElement as HTMLElement;
		replaceNodes(element, this.emojiText || '', this.emojiScale);
	}
}
