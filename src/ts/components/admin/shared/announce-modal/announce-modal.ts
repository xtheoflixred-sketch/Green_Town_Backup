import { Component, ViewChild, TemplateRef } from '@angular/core';
import { BsModalRef, BsModalService } from 'ngx-bootstrap/modal';
import { AdminModel } from '../../../services/adminModel';
import {
faBullhorn,
faHorseHead,
faExclamationCircle,
faInfoCircle,
} from '../../../../client/icons';

export type AnnounceType = 'admin' | 'announcement';
export type AlertType = 'warning' | 'danger' | 'info' | 'announcement';

@Component({
selector: 'announce-modal',
exportAs: 'announceModal',
templateUrl: 'announce-modal.pug',
styleUrls: ['announce-modal.scss'],
})
export class AnnounceModal {
@ViewChild('template', { static: true }) template!: TemplateRef<any>;
modalRef?: BsModalRef;

message = '';

// Where the global message is sent.
announceType: AnnounceType = 'admin';

// Visual alert type used by the preview.
alertType: AlertType = 'info';

readonly faBullhorn = faBullhorn;
readonly faHorseHead = faHorseHead;
readonly warningIcon = faExclamationCircle;
readonly infoIcon = faInfoCircle;

readonly typeOptions = [
    {
        label: 'Admin announce',
        value: 'admin' as AnnounceType,
        icon: faBullhorn,
        description: 'Global admin chat message.',
    },
    {
        label: 'In-game announcement',
        value: 'announcement' as AnnounceType,
        icon: faHorseHead,
        description: 'Broadcast styled announcement to all players.',
    },
];

readonly alertTypes = [
    {
        label: 'Warning',
        value: 'warning' as AlertType,
        icon: faExclamationCircle,
        description: 'Attention or important warning.',
    },
    {
        label: 'Danger',
        value: 'danger' as AlertType,
        icon: faExclamationCircle,
        description: 'Critical or urgent message.',
    },
    {
        label: 'Info',
        value: 'info' as AlertType,
        icon: faInfoCircle,
        description: 'Informational message.',
    },
    {
        label: 'Announcement',
        value: 'announcement' as AlertType,
        icon: faBullhorn,
        description: 'General global announcement.',
    },
];

constructor(
    private modalService: BsModalService,
    private model: AdminModel
) {
}

private resetState() {
    this.message = '';
    this.announceType = 'admin';

    // Admin messages start with the informational style.
    this.alertType = 'info';
}

open() {
    this.resetState();

    this.modalRef = this.modalService.show(this.template, {
        class: 'modal-lg',
    });
}

cancel() {
    if (this.modalRef) {
        this.modalRef.hide();
    }

    this.modalRef = undefined;
}

canSend() {
    return !!this.message.trim();
}

alertClass() {
    switch (this.alertType) {
        case 'danger':
            return 'alert-danger';

        case 'info':
            return 'alert-info';

        case 'announcement':
            return 'alert-announcement';

        default:
            return 'alert-warning';
    }
}

alertIcon() {
    switch (this.alertType) {
        case 'danger':
        case 'warning':
            return this.warningIcon;

        case 'info':
            return this.infoIcon;

        case 'announcement':
            return this.faBullhorn;

        default:
            return this.faBullhorn;
    }
}

alertTitle() {
    switch (this.alertType) {
        case 'danger':
            return 'Danger';

        case 'info':
            return 'Information';

        case 'announcement':
            return 'Announcement';

        default:
            return 'Warning';
    }
}

onAnnounceTypeChange(type: AnnounceType) {
    this.announceType = type;

    // Use sensible defaults when switching between modes.
    this.alertType = this.getDefaultAlertType(type);
}

onAlertTypeChange(type: AlertType) {
    if (this.isAlertTypeDisabled(type)) {
        return;
    }

    this.alertType = type;
}

isAlertTypeDisabled(type: AlertType) {
    if (this.announceType === 'announcement') {
        return type !== 'announcement';
    }

    if (this.announceType === 'admin') {
        return type === 'announcement';
    }

    return false;
}

getDefaultAlertType(type: AnnounceType): AlertType {
    return type === 'admin' ? 'info' : 'announcement';
}

send() {
    const message = this.message.trim();

    if (!message) {
        return;
    }

    /*
     * Keep the existing backend API intact:
     * model.announce() currently expects:
     *   'admin' | 'announcement'
     *
     * alertType is currently used by the client-side preview.
     */
    this.model
        .announce(message, this.announceType)
        .then(() => this.cancel())
        .catch(() => undefined);
}

}
