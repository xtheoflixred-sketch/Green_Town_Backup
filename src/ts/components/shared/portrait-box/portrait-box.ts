import {
Component, Input, AfterViewInit, OnChanges, DoCheck, ElementRef, ChangeDetectionStrategy, ViewChild, NgZone
} from '@angular/core';
import { PalettePonyInfo } from '../../../common/interfaces';
import { ContextSpriteBatch } from '../../../graphics/contextSpriteBatch';
import { createCanvas, disableImageSmoothing, getPixelRatio, resizeCanvasWithRatio } from '../../../client/canvasUtils';
import { defaultDrawPonyOptions, defaultPonyState } from '../../../client/ponyHelpers';
import { loadAndInitSpriteSheets } from '../../../client/spriteUtils';
import { drawPony } from '../../../client/ponyDraw';
import { paletteSpriteSheet } from '../../../generated/sprites';

const scales: { [key: string]: number } = {
xlarge: 4,
large: 3,
medium: 2,
small: 1,
};

const sizes: { [key: string]: number } = {
xlarge: 140,
large: 100,
medium: 66,
small: 33,
};

const BUFFER_SIZE = 34;

@Component({
selector: 'portrait-box',
templateUrl: 'portrait-box.pug',
styleUrls: ['portrait-box.scss'],
changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PortraitBox implements AfterViewInit, OnChanges, DoCheck {
@Input() noBorder = false;
@Input() flip = false;
@Input() size = 'large';
@Input() pony: PalettePonyInfo | undefined = undefined;
@Input() chatHoverColor: number | undefined = undefined;
@ViewChild('canvas', { static: true }) canvas!: ElementRef;
private frame = 0;
private batch?: ContextSpriteBatch;
private options = defaultDrawPonyOptions();
private state = defaultPonyState();
private lastToy = 0;
constructor(private zone: NgZone) {
}
ngAfterViewInit() {
loadAndInitSpriteSheets()
.then(() => this.redraw());
}
ngOnChanges() {
this.lastToy = (this.pony as any).toy || 0;
this.redraw();
}
ngDoCheck() {
const currentToy = (this.pony as any).toy || 0;
if (currentToy !== this.lastToy) {
this.lastToy = currentToy;
this.redraw();
}
}
private redraw() {
this.frame = this.frame || this.zone.runOutsideAngular(() => requestAnimationFrame(() => {
this.frame = 0;
this.draw();
}));
}
private draw() {
const canvas = this.canvas.nativeElement as HTMLCanvasElement;
const baseSize = this.size.replace('-square', '');
const size = sizes[baseSize];
resizeCanvasWithRatio(canvas, size, size);

const context = canvas.getContext('2d');

if (context) {
context.save();
context.fillStyle = '#444';
context.fillRect(0, 0, canvas.width, canvas.height);

if (this.pony) {
const scale = scales[baseSize] * getPixelRatio();
this.batch = this.batch || new ContextSpriteBatch(createCanvas(BUFFER_SIZE, BUFFER_SIZE));
this.options.flipped = !this.flip;
this.options.outlineColor = this.chatHoverColor;
this.options.toy = (this.pony as any).toy || 0;

this.batch.start(paletteSpriteSheet, 0);
drawPony(this.batch, this.pony, this.state, 25, 54, this.options);
this.batch.end();

disableImageSmoothing(context);
context.scale(this.flip ? scale : -scale, scale);
context.drawImage(this.batch.canvas, this.flip ? 0 : -BUFFER_SIZE, 0);
}

context.restore();
}
}
}