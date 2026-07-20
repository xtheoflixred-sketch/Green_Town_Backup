import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { createDefaultPony } from '../../../common/ponyInfo';
import { faInfoCircle } from '../../../client/icons';
import { MockAccount } from './mock-login-modal';

@Component({
  selector: 'mock-login-create-modal',
  templateUrl: 'mock-login-create-modal.pug',
  styleUrls: ['mock-login-create-modal.scss'],
})
export class MockLoginCreateModal implements OnChanges {
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() created = new EventEmitter<MockAccount>();

  createAccountName = '';
  createBirthday?: string;
  createPonyName = '';
  createError = '';
  createLoading = false;
  futureId = '';
  readonly infoIcon = faInfoCircle;

  constructor(private http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes.show && this.show) {
      this.futureId = this.generateFutureId();
    }
  }

  getPreviewPony() {
    return createDefaultPony();
  }

  getPreviewName() {
    const accountName = this.createAccountName.trim();
    return this.createPonyName.trim() || (accountName ? `${accountName}'s Pony` : 'Default pony');
  }

  private generateFutureId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return `${timestamp}${random}`;
  }

  submitCreateAccount() {
    const accountName = this.createAccountName.trim();
    if (!accountName) {
      this.createError = 'Enter account name';
      return;
    }

    if (!this.createBirthday) {
      this.createError = 'Enter birth date';
      return;
    }

    const ponyName = this.createPonyName.trim() || `${accountName}'s Pony`;

    this.createLoading = true;
    this.createError = '';

    this.http.post<MockAccount>('/mock-login/create', {
      id: this.futureId,
      name: accountName,
      birthdate: this.createBirthday,
      ponyName,
    }).subscribe(
      acc => {
        this.createLoading = false;
        this.created.emit(acc);
      },
      err => {
        this.createLoading = false;
        const msg = err && err.error && (err.error.error || err.error.message) || err.message || 'Failed to create account';
        this.createError = msg;
        console.error('Create mock account failed', err);
      }
    );
  }

  onClose() {
    this.close.emit();
  }
}
