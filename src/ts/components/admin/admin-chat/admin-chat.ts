import { Component, ElementRef } from '@angular/core';
import * as moment from 'moment';
import { AdminModel } from '../../services/adminModel';
import { ChatLogQuery } from '../../../common/adminInterfaces';
import { formatChat, replaceSwears } from '../../../common/adminUtils';
import { appendAllNodes, removeAllNodes, showTextInNewTab } from '../../../client/htmlUtils';
import { faFileAlt, faSearch, faSpinner, faSync } from '../../../client/icons';

@Component({
	selector: 'admin-chat',
	templateUrl: 'admin-chat.pug',
	styleUrls: ['admin-chat.scss'],
})
export class AdminChat {
	readonly fileIcon = faFileAlt;
	readonly searchIcon = faSearch;
	readonly spinnerIcon = faSpinner;
	readonly syncIcon = faSync;
	from = moment().subtract(7, 'days').format('YYYY-MM-DD');
	to = moment().format('YYYY-MM-DD');
	server = '';
	map = '';
	user = '';
	search = '';
	loading = false;
	lastQuery?: ChatLogQuery;
	chatRaw = '';

	constructor(private model: AdminModel, private element: ElementRef) {
	}

	ngOnInit() {
		this.refresh();
	}

	refresh() {
		this.lastQuery = {
			from: this.from,
			to: this.to,
			server: this.server.trim() || undefined,
			map: this.map.trim() || undefined,
			user: this.user.trim() || undefined,
			search: this.search.trim() || undefined,
		};
		this.loading = true;
		this.model.getChatRange(this.lastQuery)
			.then(raw => {
				this.chatRaw = raw || '';
				const nodes = formatChat(this.chatRaw);
				nodes.forEach(node => {
					Array.from(node.querySelectorAll('.name, .message'))
						.filter((element): element is HTMLElement => element instanceof HTMLElement)
						.forEach(replaceSwears);
				});
				const chatlog = (this.element.nativeElement as HTMLElement).querySelector('.chatlog');
				if (chatlog) {
					removeAllNodes(chatlog);
					appendAllNodes(chatlog, nodes);
				}
			})
			.finally(() => this.loading = false);
	}

	openLog() {
		showTextInNewTab(`${this.from} - ${this.to}\n\n${this.chatRaw.replace(/\t/g, ' ')}`);
	}
}