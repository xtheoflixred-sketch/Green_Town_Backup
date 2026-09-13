import { Component, EventEmitter, Output, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { toPalette, mockPaletteManager } from '../../../common/ponyInfo';
import { decodePonyInfo } from '../../../common/compressPony';
import { getConfiguredDefaultPony } from '../../../client/defaultPonyClient';
import { faUserPlus } from '../../../client/icons';

export interface MockAccount {
  id: string;
  name: string;
  ponyInfo?: string;
  lastVisit?: string;
}

@Component({
  selector: 'mock-login-modal',
  templateUrl: 'mock-login-modal.pug',
  styleUrls: ['mock-login-modal.scss'],
})
export class MockLoginModal implements OnInit, OnChanges {
  readonly toPalette = toPalette;
  readonly createDefaultPony = getConfiguredDefaultPony;
  readonly userPlusIcon = faUserPlus;
  @Input() accounts: MockAccount[] = [];
  @Input() show = false;
  @Output() close = new EventEmitter<void>();
  @Output() login = new EventEmitter<{id: string}>();
  // emits created MockAccount or `{ redirect: true }`
  @Output() create = new EventEmitter<any>();

  selectedId: string | null = null;
  error: string = '';
  search = '';
  sortMode: 'name' | 'activity' = 'activity';
  filteredAccounts: MockAccount[] = [];

  showCreateForm = false;

  constructor() {}

  getPonyInfo(ponyInfo: string | undefined) {
    if (ponyInfo) {
      return decodePonyInfo(ponyInfo, mockPaletteManager);
    }

    return toPalette(getConfiguredDefaultPony());
  }

  ngOnInit() {
    this.updateAccounts();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes.accounts) {
      this.updateAccounts();
    }

    if (changes.show) {
      if (this.show) {
        this.selectedId = null;
      } else {
        this.showCreateForm = false;
      }
    }
  }

  select(id: string) {
    if (this.selectedId === id) {
      this.selectedId = null;
    } else {
      this.selectedId = id;
    }
    this.error = '';
  }

  setSortMode(mode: 'name' | 'activity') {
    this.sortMode = mode;
    this.updateAccounts();
  }

  updateAccounts() {
    const query = this.search.trim().toLowerCase();
    let accounts = this.accounts.slice();

    if (query) {
      accounts = accounts.filter(acc => acc.name.toLowerCase().includes(query) || (acc.id && acc.id.toLowerCase().includes(query)));
    }

    this.filteredAccounts = accounts.slice().sort((a, b) => {
      if (this.sortMode === 'name') {
        return a.name.localeCompare(b.name);
      }

      const aTime = a.lastVisit ? Date.parse(a.lastVisit) : 0;
      const bTime = b.lastVisit ? Date.parse(b.lastVisit) : 0;
      if (aTime !== bTime) {
        return bTime - aTime;
      }
      return a.name.localeCompare(b.name);
    });
  }

  submit() {
    if (!this.selectedId) {
      this.error = 'Выберите аккаунт';
      return;
    }
    this.login.emit({ id: this.selectedId });
  }

  onClose() {
    this.close.emit();
  }

  openCreateAccount() {
    this.showCreateForm = true;
  }

  closeCreateAccount() {
    this.showCreateForm = false;
  }

  onAccountCreated(account: MockAccount) {
    this.showCreateForm = false;
    this.create.emit(account);
    this.login.emit({ id: account.id });
    this.onClose();
  }
}
