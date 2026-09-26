import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
// import { ScrollingModule } from '@angular/cdk/scrolling';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { TooltipModule } from 'ngx-bootstrap/tooltip';
import { PopoverModule } from 'ngx-bootstrap/popover';
import { ButtonsModule } from 'ngx-bootstrap/buttons';
import { ModalModule } from 'ngx-bootstrap/modal';

import { ActionBar } from './action-bar/action-bar';
import { ActionButton } from './action-button/action-button';
import { ActionsModal } from './actions-modal/actions-modal';
import { InventoryBar } from './inventory-bar/inventory-bar';
import { BitmapBox } from './bitmap-box/bitmap-box';
import { ButtMarkEditor } from './butt-mark-editor/butt-mark-editor';
import { MenuItem } from './menu-item/menu-item';
import { MenuBar } from './menu-bar/menu-bar';
import { CharacterList } from './character-list/character-list';
import { CharacterPreview } from './character-preview/character-preview';
import { CharacterSelect } from './character-select/character-select';
import { EmoteBox } from './emote-box/emote-box';
import { SliderBar } from './slider-bar/slider-bar';
import { SpriteBox } from './sprite-box/sprite-box';
import { SpriteSelection } from './sprite-selection/sprite-selection';
import { SetSelection, SetOutlineHidden } from './set-selection/set-selection';
import { CheckBox } from './check-box/check-box';
import { PortraitBox } from './portrait-box/portrait-box';
import { SquarePortraitBox } from './square-portrait-box/square-portrait-box';
import { ScalePicker } from './scale-picker/scale-picker';
import { ColorPicker } from './color-picker/color-picker';
import { DefaultColorPicker } from './default-color-picker/default-color-picker';
import { CustomCheckbox } from './custom-checkbox/custom-checkbox';
import { DatePicker } from './date-picker/date-picker';
import { SignInBox } from './sign-in-box/sign-in-box';
import { MockLoginModal } from './mock-login-modal/mock-login-modal';
import { MockLoginCreateModal } from './mock-login-modal/mock-login-create-modal';
import { TeleportModal } from './teleport-modal/teleport-modal';
import { TimeModal } from './time-modal/time-modal';
import { PonyBox } from './pony-box/pony-box';
import { PonyPreview } from './pony-info/pony-info';
import { ModBox } from './mod-box/mod-box';
import { PartyBox } from './party-box/party-box';
import { PartyList } from './party-list/party-list';
import { SiteInfo } from './site-info/site-info';
import { SettingsBox } from './settings-box/settings-box';
import { SettingsModal } from './settings-modal/settings-modal';
import { InvitesModal } from './invites-modal/invites-modal';
import { DeleteModal } from './delete-modal/delete-modal';
import { ImportedModal } from './imported-modal/imported-modal';
import { SignOutModal } from './sign-out-modal/sign-out-modal';
import { ChangelogModal } from './changelog-modal/changelog-modal';
import { DevChangelogModal } from './dev-changelog-modal/dev-changelog-modal';
import { ChangelogView } from './changelog-view/changelog-view';
import { SelectToyModal } from './select-toy-modal/select-toy-modal';
import { TestModal } from './test-modal/test-modal';
import { BuilderToolsModal } from './builder-tools-modal/builder-tools-modal';
import { UnsavedCharacterModal } from './unsaved-character-modal/unsaved-character-modal';
import { FillOutline } from './fill-outline/fill-outline';
import { FriendsBox } from './friends-box/friends-box';
import { InstallButton } from './install-button/install-button';
import { KbdKey } from './kbd-key/kbd-key';
import { PlayBox } from './play-box/play-box';
import { ChatBox } from './chat-box/chat-box';
import { BuildBox } from './build-box/build-box';
import { ChatLog } from './chat-log/chat-log';
import { SwapBox } from './swap-box/swap-box';
import { SiteLinks } from './site-links/site-links';
import { NotificationItem } from './notification/notification-item';
import { NotificationList } from './notification/notification-list';
import { tabsetComponents } from './tabset/tabset';
import { PlayNotice } from './play-notice/play-notice';
import { PageLoader } from './page-loader/page-loader';
import { virtualListDirectives, VirtualList } from './virtual-list/virtual-list';
import { EmojiPickerComponent } from './emoji-picker/emoji-picker';
import { EmojiInputComponent } from './emoji-input/emoji-input';
import { CustomSignModal } from './custom-sign-modal/custom-sign-modal';
import { MiniMap } from './mini-map/mini-map';
import { ScreenEntityModal } from './screen-entity-modal/screen-entity-modal';

import { Anchor } from './directives/anchor';
import { BtnHighlight, BtnHighlightDanger } from './directives/btnHighlight';
import { draggableComponents } from './directives/draggable';
import { AgDrag } from './directives/agDrag';
import { AgAutoFocus } from './directives/agAutoFocus';
import { LinkCurrent } from './directives/linkCurrent';
import { LabelledBy } from './directives/labelledBy';
import { RevSrc } from './directives/revSrc';
import { FixToTop } from './directives/fixToTop';
import { FocusTitle } from './directives/focusTitle';
import { FocusTrap } from './directives/focusTrap';
import { HasFeature } from './directives/hasFeature';
import { dropdownDirectives } from './directives/dropdown';
import { SaveActiveTab } from './directives/saveActiveTab';

import { SiteNamePipe } from './pipes/siteName';
import { VisitPTButton } from './visit-pt-button/visit-pt-button';
import { VisitPTPony } from './visit-pt-pony/visit-pt-pony';
import { TelegramButton } from './telegram-button/telegram-button';
import { TelegramPony } from './telegram-pony/telegram-pony';
import { TiktokButton } from './tiktok-button/tiktok-button';
import { TiktokPony } from './tiktok-pony/tiktok-pony';
import { VkButton } from './vk-button/vk-button';
import { VkPony } from './vk-pony/vk-pony';
import { AboutButton } from './about-button/about-button';
import { AboutPony } from './about-pony/about-pony';
import { TeamPony } from './team-pony/team-pony';
import { LeaveSiteModal } from './leave-site-modal/leave-site-modal';
import { EmojiText } from './directives/emojiText';

const declarations = [
	ActionBar,
	ActionButton,
	ActionsModal,
	BitmapBox,
	ButtMarkEditor,
	MenuBar,
	MenuItem,
	CharacterList,
	CharacterPreview,
	CharacterSelect,
	EmoteBox,
	EmojiPickerComponent,
	EmojiInputComponent,
	CustomSignModal,
	ScreenEntityModal,
	SliderBar,
	SpriteBox,
	SpriteSelection,
	VisitPTButton,
	VisitPTPony,
	TelegramButton,
	TelegramPony,
	TiktokButton,
	TiktokPony,
	VkButton,
	VkPony,
	AboutButton,
	AboutButton,
	AboutPony,
	TeamPony,
	SetSelection,
	SetOutlineHidden,
	CheckBox,
	PortraitBox,
	SquarePortraitBox,
	ScalePicker,
	SwapBox,
	ColorPicker,
	DefaultColorPicker,
	CustomCheckbox,
	DatePicker,
	SignInBox,
	MockLoginModal,
	MockLoginCreateModal,
	TeleportModal,
	TimeModal,
	PonyBox,
	PonyPreview,
	ModBox,
	PartyBox,
	PartyList,
	SiteInfo,
	SettingsBox,
	SettingsModal,
	FillOutline,
	FriendsBox,
	InstallButton,
	InvitesModal,
	DeleteModal,
	ImportedModal,
	SignOutModal,
	ChangelogModal,
	DevChangelogModal,
	ChangelogView,
	InventoryBar,
	SelectToyModal,
	TestModal,
	BuilderToolsModal,
	UnsavedCharacterModal,
	LeaveSiteModal,
	KbdKey,
	PlayBox,
	PlayNotice,
	PageLoader,
	ChatBox,
	BuildBox,
	ChatLog,
	SiteLinks,
	NotificationItem,
	NotificationList,
	EmojiText,
	MiniMap,
	...dropdownDirectives,
	...tabsetComponents,
	...draggableComponents,
	...virtualListDirectives,
	VirtualList,
	Anchor,
	BtnHighlight,
	BtnHighlightDanger,
	AgDrag,
	AgAutoFocus,
	LinkCurrent,
	LabelledBy,
	RevSrc,
	FixToTop,
	FocusTitle,
	FocusTrap,
	HasFeature,
	SaveActiveTab,
	SiteNamePipe,
];

@NgModule({
	imports: [
		BrowserModule,
		RouterModule,
		FormsModule,
		TooltipModule.forRoot(),
		PopoverModule,
		ButtonsModule,
		ModalModule.forRoot(),
		FontAwesomeModule,
		// ScrollingModule,
	],
	declarations: declarations,
	exports: declarations,
})
export class SharedModule {
}
