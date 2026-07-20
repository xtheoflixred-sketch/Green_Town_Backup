import { clamp } from '../../../common/utils';

export type RubberPanelCorner = 'bottom-left' | 'top-left' | 'bottom-right' | 'top-right';
export type RubberPanelHorizontalEdge = 'left' | 'right';
export type RubberPanelVerticalEdge = 'top' | 'bottom';

export interface RubberPanelAxisLimits {
	min: number;
	max: number;
	defaultValue: number;
}

export interface RubberPanelLayout {
	width: number;
	height: number;
	top?: number;
}

export interface RubberPanelState extends RubberPanelLayout {
	minWidth: number;
	minHeight: number;
	contentOffsetX: number;
	contentOffsetY: number;
	contentStretchX: number;
	contentStretchY: number;
	isOverLimit: boolean;
}

export interface RubberPanelResizeEdges {
	horizontal: RubberPanelHorizontalEdge;
	vertical: RubberPanelVerticalEdge;
}

export interface RubberPanelPhysicsTuning {
	rubberBandFactor?: number;
	dragElasticity?: number;
	dragRangeForceFactor?: number;
	physicsSmoothing?: number;
	springStiffness?: number;
	springDamping?: number;
	releaseVelocityFactor?: number;
	dragPhysicsFactor?: number;
	dragReleaseFactor?: number;
	forceScale?: number;
	forceClamp?: number;
	stretchMajorScale?: number;
	stretchMinorScale?: number;
	stretchMin?: number;
	stretchMax?: number;
	settleDistance?: number;
	settleVelocity?: number;
	resetAfterOverLimitDrags?: number;
}

export interface RubberPanelControllerOptions {
	width: RubberPanelAxisLimits;
	height: RubberPanelAxisLimits;
	resizeEdges: RubberPanelResizeEdges;
	onUpdate: (state: RubberPanelState) => void;
	tuning?: RubberPanelPhysicsTuning;
}

interface ResizeSnapshot extends RubberPanelLayout {
	rawWidth: number;
	rawHeight: number;
	targetWidth: number;
	targetHeight: number;
	widthOvershoot: number;
	heightOvershoot: number;
}

const DEFAULT_TUNING = {
	rubberBandFactor: 0.08,
	dragElasticity: 0,
	dragRangeForceFactor: 0,
	physicsSmoothing: 1,
	springStiffness: 0.09,
	springDamping: 0.8,
	releaseVelocityFactor: 0.12,
	dragPhysicsFactor: 0,
	dragReleaseFactor: 0,
	forceScale: 0.045,
	forceClamp: 7,
	stretchMajorScale: 0.0009,
	stretchMinorScale: 0.00035,
	stretchMin: 0.96,
	stretchMax: 1.06,
	settleDistance: 0.35,
	settleVelocity: 0.2,
	resetAfterOverLimitDrags: 0,
};

export function rubberPanelResizeEdgesFromCorner(corner: RubberPanelCorner): RubberPanelResizeEdges {
	switch (corner) {
		case 'bottom-left': return { horizontal: 'left', vertical: 'bottom' };
		case 'top-left': return { horizontal: 'left', vertical: 'top' };
		case 'bottom-right': return { horizontal: 'right', vertical: 'bottom' };
		case 'top-right': return { horizontal: 'right', vertical: 'top' };
		default: return { horizontal: 'right', vertical: 'top' };
	}
}

export class RubberPanelController {
	private readonly tuning = { ...DEFAULT_TUNING, ...(this.options.tuning || {}) };
	private readonly state: RubberPanelState;
	private animationFrame?: number;
	private springVelocityWidth = 0;
	private springVelocityHeight = 0;
	private springVelocityTop = 0;
	private resizeStart?: RubberPanelLayout;
	private lastResize?: ResizeSnapshot;
	private lastDragDeltaWidth = 0;
	private lastDragDeltaHeight = 0;
	private overLimitDragCount = 0;
	private defaultLayout?: RubberPanelLayout;

	constructor(private readonly options: RubberPanelControllerOptions) {
		this.state = {
			width: options.width.defaultValue,
			height: options.height.defaultValue,
			top: undefined,
			minWidth: options.width.min,
			minHeight: options.height.min,
			contentOffsetX: 0,
			contentOffsetY: 0,
			contentStretchX: 1,
			contentStretchY: 1,
			isOverLimit: false,
		};
	}

	get currentState() {
		return this.state;
	}

	setDefaultLayout(layout: RubberPanelLayout) {
		this.defaultLayout = { ...layout };
	}

	sync(layout: RubberPanelLayout) {
		this.stopAnimation();
		this.assignState({
			width: layout.width,
			height: layout.height,
			top: layout.top,
			minWidth: this.options.width.min,
			minHeight: this.options.height.min,
			isOverLimit: false,
		});
		this.resetContentPhysics();
		this.emit();
	}

	beginResize(layout: RubberPanelLayout) {
		this.stopAnimation();
		this.resizeStart = { ...layout };
		this.lastResize = undefined;
		this.lastDragDeltaWidth = 0;
		this.lastDragDeltaHeight = 0;
		this.assignState({
			minWidth: 0,
			minHeight: 0,
			width: layout.width,
			height: layout.height,
			top: layout.top,
		});
		this.emit();
	}

	resizeBy(dx: number, dy: number) {
		if (!this.resizeStart) {
			return;
		}

		const rawWidth = this.resizeStart.width + dx * this.horizontalDirection;
		const rawHeight = this.resizeStart.height + dy * this.verticalDirection;
		const targetWidth = clamp(rawWidth, this.options.width.min, this.options.width.max);
		const targetHeight = clamp(rawHeight, this.options.height.min, this.options.height.max);
		const displayWidth = this.resolveDisplaySize(rawWidth, targetWidth, this.state.width, this.options.width.min, this.options.width.max);
		const displayHeight = this.resolveDisplaySize(rawHeight, targetHeight, this.state.height, this.options.height.min, this.options.height.max);
		const widthOvershoot = displayWidth - targetWidth;
		const heightOvershoot = displayHeight - targetHeight;
		const widthRangeForce = (targetWidth - this.resizeStart.width) * this.tuning.dragRangeForceFactor;
		const heightRangeForce = (targetHeight - this.resizeStart.height) * this.tuning.dragRangeForceFactor;
		const widthDragDelta = this.lastResize ? displayWidth - this.lastResize.width : 0;
		const heightDragDelta = this.lastResize ? displayHeight - this.lastResize.height : 0;
		const widthPhysicsForce = widthOvershoot + widthRangeForce + widthDragDelta * this.tuning.dragPhysicsFactor;
		const heightPhysicsForce = heightOvershoot + heightRangeForce + heightDragDelta * this.tuning.dragPhysicsFactor;
		const top = this.resolveAnchoredTop(this.resizeStart.top, this.resizeStart.height, displayHeight);

		this.lastResize = {
			width: displayWidth,
			height: displayHeight,
			top,
			rawWidth,
			rawHeight,
			targetWidth,
			targetHeight,
			widthOvershoot,
			heightOvershoot,
		};

		this.assignState({
			width: displayWidth,
			height: displayHeight,
			top,
			isOverLimit: this.isRawOverLimit(rawWidth, rawHeight),
		});
		this.lastDragDeltaWidth = widthDragDelta;
		this.lastDragDeltaHeight = heightDragDelta;
		this.updateContentPhysics(this.horizontalForce(widthPhysicsForce), this.verticalForce(heightPhysicsForce));
		this.emit();
	}

	endResize(onComplete?: () => void) {
		if (!this.resizeStart || !this.lastResize) {
			this.resizeStart = undefined;
			return false;
		}

		const releaseWidthOvershoot = this.getOvershoot(this.lastResize.rawWidth, this.options.width.min, this.options.width.max);
		const releaseHeightOvershoot = this.getOvershoot(this.lastResize.rawHeight, this.options.height.min, this.options.height.max);
		const releaseWidthForce = releaseWidthOvershoot + this.lastDragDeltaWidth * this.tuning.dragReleaseFactor;
		const releaseHeightForce = releaseHeightOvershoot + this.lastDragDeltaHeight * this.tuning.dragReleaseFactor;
		const wasOverLimit = this.state.isOverLimit;
		const resetThreshold = this.tuning.resetAfterOverLimitDrags || 0;
		this.overLimitDragCount = wasOverLimit ? this.overLimitDragCount + 1 : 0;
		const shouldResetToDefault = !!resetThreshold && !!this.defaultLayout && this.overLimitDragCount >= resetThreshold;

		if (shouldResetToDefault) {
			this.overLimitDragCount = 0;
		}

		this.springVelocityWidth = -releaseWidthForce * this.tuning.releaseVelocityFactor;
		this.springVelocityHeight = -releaseHeightForce * this.tuning.releaseVelocityFactor;
		this.springVelocityTop = this.options.resizeEdges.vertical === 'top' ? -this.springVelocityHeight : 0;

		const targetLayout = shouldResetToDefault && this.defaultLayout ? this.defaultLayout : {
			width: this.lastResize.targetWidth,
			height: this.lastResize.targetHeight,
			top: this.resolveAnchoredTop(this.resizeStart.top, this.resizeStart.height, this.lastResize.targetHeight),
		};

		this.resizeStart = undefined;
		this.lastDragDeltaWidth = 0;
		this.lastDragDeltaHeight = 0;
		this.startSpringAnimation(targetLayout, true, true, onComplete);
		return shouldResetToDefault;
	}

	open(layout: RubberPanelLayout) {
		this.assignState({ minWidth: 0, minHeight: 0 });
		this.assignState({
			width: 0,
			height: 0,
			top: this.resolveAnchoredTop(layout.top, layout.height, 0),
		});
		this.updateContentPhysics(this.horizontalForce(layout.width), this.verticalForce(layout.height));
		this.emit();
		this.startSpringAnimation(layout, false, false);
	}

	close(layout: RubberPanelLayout, onComplete?: () => void) {
		const targetLayout = {
			width: 0,
			height: 0,
			top: this.resolveAnchoredTop(layout.top, layout.height, 0),
		};

		this.assignState({
			minWidth: 0,
			minHeight: 0,
			width: layout.width,
			height: layout.height,
			top: layout.top,
		});
		this.updateContentPhysics(this.horizontalForce(layout.width), this.verticalForce(layout.height));
		this.emit();
		this.startSpringAnimation(targetLayout, false, false, onComplete);
	}

	stopAnimation() {
		if (this.animationFrame !== undefined) {
			cancelAnimationFrame(this.animationFrame);
			this.animationFrame = undefined;
		}
	}

	destroy() {
		this.stopAnimation();
	}

	private get horizontalDirection() {
		return this.options.resizeEdges.horizontal === 'left' ? -1 : 1;
	}

	private get verticalDirection() {
		return this.options.resizeEdges.vertical === 'top' ? -1 : 1;
	}

	private horizontalForce(value: number) {
		return this.horizontalDirection * value;
	}

	private verticalForce(value: number) {
		return this.verticalDirection * value;
	}

	private emit() {
		this.options.onUpdate(this.state);
	}

	private assignState(patch: Partial<RubberPanelState>) {
		Object.assign(this.state, patch);
	}

	private resetContentPhysics() {
		this.state.contentOffsetX = 0;
		this.state.contentOffsetY = 0;
		this.state.contentStretchX = 1;
		this.state.contentStretchY = 1;
	}

	private updateContentPhysics(horizontalForce: number, verticalForce: number) {
		const clampedX = clamp(horizontalForce * this.tuning.forceScale, -this.tuning.forceClamp, this.tuning.forceClamp);
		const clampedY = clamp(verticalForce * this.tuning.forceScale, -this.tuning.forceClamp, this.tuning.forceClamp);
		const stretchX = clamp(
			1 + Math.abs(horizontalForce) * this.tuning.stretchMajorScale - Math.abs(verticalForce) * this.tuning.stretchMinorScale,
			this.tuning.stretchMin,
			this.tuning.stretchMax,
		);
		const stretchY = clamp(
			1 + Math.abs(verticalForce) * this.tuning.stretchMajorScale - Math.abs(horizontalForce) * this.tuning.stretchMinorScale,
			this.tuning.stretchMin,
			this.tuning.stretchMax,
		);
		const smoothing = clamp(this.tuning.physicsSmoothing, 0, 1);

		this.state.contentOffsetX += (clampedX - this.state.contentOffsetX) * smoothing;
		this.state.contentOffsetY += (clampedY - this.state.contentOffsetY) * smoothing;
		this.state.contentStretchX += (stretchX - this.state.contentStretchX) * smoothing;
		this.state.contentStretchY += (stretchY - this.state.contentStretchY) * smoothing;
	}

	private applyRubberBand(value: number, min: number, max: number) {
		if (value < min) {
			return min - (min - value) * this.tuning.rubberBandFactor;
		} else if (value > max) {
			return max + (value - max) * this.tuning.rubberBandFactor;
		} else {
			return value;
		}
	}

	private resolveDisplaySize(rawValue: number, targetValue: number, currentValue: number, min: number, max: number) {
		if (rawValue < min || rawValue > max) {
			return this.applyRubberBand(rawValue, min, max);
		}

		const dragElasticity = clamp(this.tuning.dragElasticity, 0, 0.95);

		if (!dragElasticity) {
			return targetValue;
		}

		return currentValue + (targetValue - currentValue) * (1 - dragElasticity);
	}

	private getOvershoot(value: number, min: number, max: number) {
		if (value < min) {
			return value - min;
		} else if (value > max) {
			return value - max;
		} else {
			return 0;
		}
	}

	private resolveAnchoredTop(baseTop: number | undefined, baseHeight: number, nextHeight: number) {
		if (baseTop === undefined) {
			return undefined;
		}

		return this.options.resizeEdges.vertical === 'top'
			? baseTop + (baseHeight - nextHeight)
			: baseTop;
	}

	private isRawOverLimit(rawWidth: number, rawHeight: number) {
		return rawWidth < this.options.width.min ||
			rawWidth > this.options.width.max ||
			rawHeight < this.options.height.min ||
			rawHeight > this.options.height.max;
	}

	private startSpringAnimation(
		targetLayout: RubberPanelLayout,
		preserveVelocity: boolean,
		trackOverLimit: boolean,
		onComplete?: () => void,
	) {
		this.stopAnimation();

		if (!preserveVelocity) {
			this.springVelocityWidth = 0;
			this.springVelocityHeight = 0;
			this.springVelocityTop = 0;
		}

		const animate = () => {
			const currentWidth = this.state.width;
			const currentHeight = this.state.height;
			const currentTop = targetLayout.top === undefined ? undefined : this.state.top;

			this.springVelocityWidth = (this.springVelocityWidth + (targetLayout.width - currentWidth) * this.tuning.springStiffness) * this.tuning.springDamping;
			this.springVelocityHeight = (this.springVelocityHeight + (targetLayout.height - currentHeight) * this.tuning.springStiffness) * this.tuning.springDamping;

			this.state.width = currentWidth + this.springVelocityWidth;
			this.state.height = currentHeight + this.springVelocityHeight;

			if (targetLayout.top !== undefined && currentTop !== undefined) {
				this.springVelocityTop = (this.springVelocityTop + (targetLayout.top - currentTop) * this.tuning.springStiffness) * this.tuning.springDamping;
				this.state.top = currentTop + this.springVelocityTop;
			} else {
				this.state.top = targetLayout.top;
			}

			this.updateContentPhysics(
				this.horizontalForce(this.springVelocityWidth),
				this.verticalForce(this.springVelocityHeight),
			);

			this.state.isOverLimit = trackOverLimit && this.isRawOverLimit(this.state.width, this.state.height);
			this.emit();

			const widthSettled = Math.abs(targetLayout.width - this.state.width) < this.tuning.settleDistance && Math.abs(this.springVelocityWidth) < this.tuning.settleVelocity;
			const heightSettled = Math.abs(targetLayout.height - this.state.height) < this.tuning.settleDistance && Math.abs(this.springVelocityHeight) < this.tuning.settleVelocity;
			const topSettled = targetLayout.top === undefined || (this.state.top !== undefined && Math.abs(targetLayout.top - this.state.top) < this.tuning.settleDistance && Math.abs(this.springVelocityTop) < this.tuning.settleVelocity);

			if (widthSettled && heightSettled && topSettled) {
				this.animationFrame = undefined;
				this.assignState({
					width: targetLayout.width,
					height: targetLayout.height,
					top: targetLayout.top,
					minWidth: this.options.width.min,
					minHeight: this.options.height.min,
					isOverLimit: false,
				});
				this.resetContentPhysics();
				this.emit();
				onComplete && onComplete();
				return;
			}

			this.animationFrame = requestAnimationFrame(animate);
		};

		this.animationFrame = requestAnimationFrame(animate);
	}
}
