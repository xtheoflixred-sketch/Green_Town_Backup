import { Component, OnInit, OnDestroy, Input, ViewChild, OnChanges } from '@angular/core';
import { defaultPonyState } from '../../../client/ponyHelpers';
import { SUPPORTER_PONY } from '../../../common/constants';
import { Expression, Muzzle, HeadAnimation, BodyAnimation, Iris, ExpressionExtra, PonyInfo } from '../../../common/interfaces';
import { excite_meno, happy_tongue_meno, stand, boop, happy_tongue_meno_2, yawn } from '../../../client/ponyAnimations';
import { FrameService, FrameLoop } from '../../services/frameService';
import { CharacterPreview } from '../character-preview/character-preview';
import { decompressPonyString } from '../../../common/compressPony';

const DERP: Partial<Expression> = {
	muzzle: Muzzle.Smile,
};

const SLEEP: Partial<Expression> = {
	leftIris: Iris.Forward,
	rightIris: Iris.Forward,
	muzzle: Muzzle.Neutral,
	extra: ExpressionExtra.Zzz,
};

const EXCITED: Partial<Expression> = {
	muzzle: Muzzle.SmileOpen,
};

const YAWN: Partial<Expression> = {
	muzzle: Muzzle.SmileOpen,
};

const BLEP: Partial<Expression> = {
	muzzle: Muzzle.Blep,
};
@Component({
	selector: 'team-pony',
	templateUrl: 'team-pony.pug',
})
export class TeamPony implements OnInit, OnDestroy, OnChanges {
	@ViewChild('characterPreview', { static: true }) characterPreview!: CharacterPreview;
	@Input() scale = 3;
	@Input() pony?: PonyInfo;
	@Input() name?: string;
	@Input() tag?: string;
	@Input() showName = true;
	@Input() showTag = true;
	@Input() noShadow = true;
	@Input() topOffset = -20;
	@Input() tagColor?: string;
	ponyData = decompressPonyString(SUPPORTER_PONY);
	state = defaultPonyState();

	get previewPony() {
		return this.pony || this.ponyData;
	}

	get previewName() {
		return this.showName ? this.name : undefined;
	}

	get previewTag() {
		return this.showTag ? this.tag : undefined;
	}
	private expression?: Partial<Expression>;
	private headAnimation?: HeadAnimation;
	private headTime = 0;
	private bodyAnimation?: BodyAnimation;
	private bodyTime = 0;
	private lastInteractionTime = 0;
	private isSleeping = false;
	private sleepThreshold = this.randomBetween(70000, 140000);
	private sleepDuration = this.randomBetween(10000, 50000);
	private sleepUntil = 0;
	private nudgesSinceInteraction = 0;
	private requiredNudgesBeforeSleep = this.randomBetween(2, 3);
	private lastYawnTime = 0;
	private loop: FrameLoop;

	constructor(frameService: FrameService) {
		this.loop = frameService.create(delta => this.tick(delta));
	}

	ngOnInit() {
		this.loop.init();
		this.registerInteraction(Date.now());
	}

	ngOnChanges() {
		if (this.pony) {
			this.ponyData = this.pony;
		}
	}

	ngOnDestroy() {
		this.loop.destroy();
	}

	yawn() {
		this.headTime = 0;
		this.registerInteraction(Date.now());
		this.headAnimation = yawn;
		this.expression = Math.random() < 0.2 ? DERP : YAWN;
	}

	nudge() {
		this.headTime = 0;
		this.bodyTime = 0;
		this.nudgesSinceInteraction++;
		if (this.isSleeping) {
			this.exitSleep();
		}
		this.expression = EXCITED;
		this.headAnimation = excite_meno;
		this.bodyAnimation = boop;
	}

	excite() {
		this.nudge();
	}

	select() {
		this.headTime = 0;
		this.bodyTime = 0;
		this.registerInteraction(Date.now());

		if (this.isSleeping) {
			this.exitSleep();
			this.headAnimation = excite_meno;
			this.expression = YAWN;
			this.bodyAnimation = stand;
			return;
		}

		this.expression = EXCITED;
		this.bodyAnimation = Math.random() < 0.25 ? boop : stand;

		const headRandom = Math.random();
		if (headRandom < 0.5) {
			this.headAnimation = excite_meno;
		} else if (headRandom < 0.8) {
			this.headAnimation = happy_tongue_meno;
		} else {
			this.headAnimation = happy_tongue_meno_2;
		}
	}

	reset() {
		this.registerInteraction(Date.now());
		if (!this.isSleeping) {
			this.expression = undefined;
		}
	}

	private tick(delta: number) {
		this.headTime += delta;
		this.bodyTime += delta;
		const now = Date.now();

		if (this.isSleeping && now >= this.sleepUntil) {
			this.exitSleep();
			this.registerInteraction(now);
			this.headTime = 0;
			this.headAnimation = yawn;
			this.expression = YAWN;
			this.bodyAnimation = stand;
		}

		const idle = now - this.lastInteractionTime;

		const hasEnoughNudges = this.nudgesSinceInteraction >= this.requiredNudgesBeforeSleep;
		const forceSleep = idle > (this.sleepThreshold + 60000);

		if (!this.isSleeping
			&& idle > this.sleepThreshold
			&& (hasEnoughNudges || forceSleep)) {
			this.enterSleep(now);
		}

		if (!this.isSleeping && !this.headAnimation && idle > 5000 && idle < 28000) {
			const timeSinceYawn = Date.now() - this.lastYawnTime;
			if (timeSinceYawn > 10000 && Math.random() < 0.003) {
				this.lastYawnTime = Date.now();
				this.headTime = 0;
				this.headAnimation = yawn;
				this.expression = YAWN;
			}
		}

		if (this.headAnimation) {
			const frame = Math.floor(this.headTime * this.headAnimation.fps);

			if (frame >= this.headAnimation.frames.length && !this.headAnimation.loop) {
				this.headAnimation = undefined;
				this.state.headAnimation = undefined;
				this.state.headAnimationFrame = 0;
				this.characterPreview.blink();
			} else {
				this.state.headAnimation = this.headAnimation;
				this.state.headAnimationFrame = frame % this.headAnimation.frames.length;
			}
		} else {
			this.state.headAnimation = undefined;

			if (!this.isSleeping) {
				if (this.expression) {
					if (Math.random() < 0.01) {
						this.expression = undefined;
					}
				} else if (Math.random() < 0.005) {
					this.expression = BLEP;
				}
			}
		}

		if (this.bodyAnimation) {
			const frame = Math.floor(this.bodyTime * this.bodyAnimation.fps * 0.75);

			if (frame >= this.bodyAnimation.frames.length && !this.bodyAnimation.loop) {
				this.bodyAnimation = undefined;
				this.state.animation = stand;
				this.state.animationFrame = 0;
			} else {
				this.state.animation = this.bodyAnimation;
				this.state.animationFrame = frame % this.bodyAnimation.frames.length;
			}
		}

		this.state.expression = this.expression as Expression | undefined;
	}

	private enterSleep(now: number) {
		this.isSleeping = true;
		this.sleepUntil = now + this.sleepDuration;
		this.expression = SLEEP;
		this.headAnimation = undefined;
		this.bodyAnimation = undefined;
	}

	private exitSleep() {
		this.isSleeping = false;
		this.sleepUntil = 0;
	}

	private registerInteraction(now: number) {
		this.lastInteractionTime = now;
		this.nudgesSinceInteraction = 0;
		this.requiredNudgesBeforeSleep = this.randomBetween(2, 3);
		this.sleepThreshold = this.randomBetween(70000, 140000);
		this.sleepDuration = this.randomBetween(10000, 50000);
	}

	private randomBetween(min: number, max: number) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}
}

