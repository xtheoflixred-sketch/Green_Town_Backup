import { Component, Input, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'game-character-modal-preview',
  template: `
    <div class="character-preview-box modal-preview-box" [class.fixed-to-top]="fixed" #box>
      <ng-content></ng-content>
    </div>
  `,
  styleUrls: ['game-character-modal-preview.scss']
})
export class GameCharacterModalPreview implements AfterViewInit {
  @Input() fixToTopOffset: number = -40;
  fixed = false;

  constructor(private el: ElementRef) {}

  ngAfterViewInit() {
    const box = this.el.nativeElement.querySelector('.character-preview-box');
    const onScroll = () => {
      const rect = box.getBoundingClientRect();
      this.fixed = rect.top < this.fixToTopOffset;
    };
    document.addEventListener('scroll', onScroll, true);
  }
}
