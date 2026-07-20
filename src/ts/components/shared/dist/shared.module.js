"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
exports.__esModule = true;
exports.SharedModule = void 0;
var core_1 = require("@angular/core");
var platform_browser_1 = require("@angular/platform-browser");
var router_1 = require("@angular/router");
var forms_1 = require("@angular/forms");
// import { ScrollingModule } from '@angular/cdk/scrolling';
var angular_fontawesome_1 = require("@fortawesome/angular-fontawesome");
var tooltip_1 = require("ngx-bootstrap/tooltip");
var popover_1 = require("ngx-bootstrap/popover");
var buttons_1 = require("ngx-bootstrap/buttons");
var modal_1 = require("ngx-bootstrap/modal");
var action_bar_1 = require("./action-bar/action-bar");
var action_button_1 = require("./action-button/action-button");
var actions_modal_1 = require("./actions-modal/actions-modal");
var bitmap_box_1 = require("./bitmap-box/bitmap-box");
var butt_mark_editor_1 = require("./butt-mark-editor/butt-mark-editor");
var menu_item_1 = require("./menu-item/menu-item");
var menu_bar_1 = require("./menu-bar/menu-bar");
var character_list_1 = require("./character-list/character-list");
var character_preview_1 = require("./character-preview/character-preview");
var character_select_1 = require("./character-select/character-select");
var emote_box_1 = require("./emote-box/emote-box");
var slider_bar_1 = require("./slider-bar/slider-bar");
var sprite_box_1 = require("./sprite-box/sprite-box");
var sprite_selection_1 = require("./sprite-selection/sprite-selection");
var set_selection_1 = require("./set-selection/set-selection");
var check_box_1 = require("./check-box/check-box");
var portrait_box_1 = require("./portrait-box/portrait-box");
var scale_picker_1 = require("./scale-picker/scale-picker");
var color_picker_1 = require("./color-picker/color-picker");
var custom_checkbox_1 = require("./custom-checkbox/custom-checkbox");
var date_picker_1 = require("./date-picker/date-picker");
var sign_in_box_1 = require("./sign-in-box/sign-in-box");
var mock_login_modal_1 = require("./mock-login-modal/mock-login-modal");
var mock_login_create_modal_1 = require("./mock-login-modal/mock-login-create-modal");
var pony_box_1 = require("./pony-box/pony-box");
var pony_info_1 = require("./pony-info/pony-info");
var mod_box_1 = require("./mod-box/mod-box");
var party_box_1 = require("./party-box/party-box");
var party_list_1 = require("./party-list/party-list");
var site_info_1 = require("./site-info/site-info");
var settings_box_1 = require("./settings-box/settings-box");
var settings_modal_1 = require("./settings-modal/settings-modal");
var invites_modal_1 = require("./invites-modal/invites-modal");
var delete_modal_1 = require("./delete-modal/delete-modal");
var changelog_modal_1 = require("./changelog-modal/changelog-modal");
var changelog_view_1 = require("./changelog-view/changelog-view");
var select_toy_modal_1 = require("./select-toy-modal/select-toy-modal");
var test_modal_1 = require("./test-modal/test-modal");
var unsaved_character_modal_1 = require("./unsaved-character-modal/unsaved-character-modal");
var fill_outline_1 = require("./fill-outline/fill-outline");
var friends_box_1 = require("./friends-box/friends-box");
var install_button_1 = require("./install-button/install-button");
var kbd_key_1 = require("./kbd-key/kbd-key");
var play_box_1 = require("./play-box/play-box");
var chat_box_1 = require("./chat-box/chat-box");
var build_box_1 = require("./build-box/build-box");
var chat_log_1 = require("./chat-log/chat-log");
var swap_box_1 = require("./swap-box/swap-box");
var site_links_1 = require("./site-links/site-links");
var notification_item_1 = require("./notification/notification-item");
var notification_list_1 = require("./notification/notification-list");
var tabset_1 = require("./tabset/tabset");
var play_notice_1 = require("./play-notice/play-notice");
var page_loader_1 = require("./page-loader/page-loader");
var virtual_list_1 = require("./virtual-list/virtual-list");
var emoji_picker_1 = require("./emoji-picker/emoji-picker");
var emoji_input_1 = require("./emoji-input/emoji-input");
var anchor_1 = require("./directives/anchor");
var btnHighlight_1 = require("./directives/btnHighlight");
var draggable_1 = require("./directives/draggable");
var agDrag_1 = require("./directives/agDrag");
var agAutoFocus_1 = require("./directives/agAutoFocus");
var linkCurrent_1 = require("./directives/linkCurrent");
var labelledBy_1 = require("./directives/labelledBy");
var revSrc_1 = require("./directives/revSrc");
var fixToTop_1 = require("./directives/fixToTop");
var focusTitle_1 = require("./directives/focusTitle");
var focusTrap_1 = require("./directives/focusTrap");
var hasFeature_1 = require("./directives/hasFeature");
var dropdown_1 = require("./directives/dropdown");
var saveActiveTab_1 = require("./directives/saveActiveTab");
var siteName_1 = require("./pipes/siteName");
var visit_pt_button_1 = require("./visit-pt-button/visit-pt-button");
var visit_pt_pony_1 = require("./visit-pt-pony/visit-pt-pony");
var telegram_button_1 = require("./telegram-button/telegram-button");
var telegram_pony_1 = require("./telegram-pony/telegram-pony");
var vk_button_1 = require("./vk-button/vk-button");
var vk_pony_1 = require("./vk-pony/vk-pony");
var about_button_1 = require("./about-button/about-button");
var about_pony_1 = require("./about-pony/about-pony");
var team_pony_1 = require("./team-pony/team-pony");
var leave_site_modal_1 = require("./leave-site-modal/leave-site-modal");
var declarations = __spreadArrays([
    action_bar_1.ActionBar,
    action_button_1.ActionButton,
    actions_modal_1.ActionsModal,
    bitmap_box_1.BitmapBox,
    butt_mark_editor_1.ButtMarkEditor,
    menu_bar_1.MenuBar,
    menu_item_1.MenuItem,
    character_list_1.CharacterList,
    character_preview_1.CharacterPreview,
    character_select_1.CharacterSelect,
    emote_box_1.EmoteBox,
    emoji_picker_1.EmojiPickerComponent,
    emoji_input_1.EmojiInputComponent,
    slider_bar_1.SliderBar,
    sprite_box_1.SpriteBox,
    sprite_selection_1.SpriteSelection,
    visit_pt_button_1.VisitPTButton,
    visit_pt_pony_1.VisitPTPony,
    telegram_button_1.TelegramButton,
    telegram_pony_1.TelegramPony,
    vk_button_1.VkButton,
    vk_pony_1.VkPony,
    about_button_1.AboutButton,
    about_button_1.AboutButton,
    about_pony_1.AboutPony,
    team_pony_1.TeamPony,
    set_selection_1.SetSelection,
    set_selection_1.SetOutlineHidden,
    check_box_1.CheckBox,
    portrait_box_1.PortraitBox,
    scale_picker_1.ScalePicker,
    swap_box_1.SwapBox,
    color_picker_1.ColorPicker,
    custom_checkbox_1.CustomCheckbox,
    date_picker_1.DatePicker,
    sign_in_box_1.SignInBox,
    mock_login_modal_1.MockLoginModal,
    mock_login_create_modal_1.MockLoginCreateModal,
    pony_box_1.PonyBox,
    pony_info_1.PonyPreview,
    mod_box_1.ModBox,
    party_box_1.PartyBox,
    party_list_1.PartyList,
    site_info_1.SiteInfo,
    settings_box_1.SettingsBox,
    settings_modal_1.SettingsModal,
    fill_outline_1.FillOutline,
    friends_box_1.FriendsBox,
    install_button_1.InstallButton,
    invites_modal_1.InvitesModal,
    delete_modal_1.DeleteModal,
    changelog_modal_1.ChangelogModal,
    changelog_view_1.ChangelogView,
    select_toy_modal_1.SelectToyModal,
    test_modal_1.TestModal,
    unsaved_character_modal_1.UnsavedCharacterModal,
    leave_site_modal_1.LeaveSiteModal,
    kbd_key_1.KbdKey,
    play_box_1.PlayBox,
    play_notice_1.PlayNotice,
    page_loader_1.PageLoader,
    chat_box_1.ChatBox,
    build_box_1.BuildBox,
    chat_log_1.ChatLog,
    site_links_1.SiteLinks,
    notification_item_1.NotificationItem,
    notification_list_1.NotificationList
], dropdown_1.dropdownDirectives, tabset_1.tabsetComponents, draggable_1.draggableComponents, virtual_list_1.virtualListDirectives, [
    virtual_list_1.VirtualList,
    anchor_1.Anchor,
    btnHighlight_1.BtnHighlight,
    btnHighlight_1.BtnHighlightDanger,
    agDrag_1.AgDrag,
    agAutoFocus_1.AgAutoFocus,
    linkCurrent_1.LinkCurrent,
    labelledBy_1.LabelledBy,
    revSrc_1.RevSrc,
    fixToTop_1.FixToTop,
    focusTitle_1.FocusTitle,
    focusTrap_1.FocusTrap,
    hasFeature_1.HasFeature,
    saveActiveTab_1.SaveActiveTab,
    siteName_1.SiteNamePipe,
]);
var SharedModule = /** @class */ (function () {
    function SharedModule() {
    }
    SharedModule = __decorate([
        core_1.NgModule({
            imports: [
                platform_browser_1.BrowserModule,
                router_1.RouterModule,
                forms_1.FormsModule,
                tooltip_1.TooltipModule.forRoot(),
                popover_1.PopoverModule,
                buttons_1.ButtonsModule,
                modal_1.ModalModule.forRoot(),
                angular_fontawesome_1.FontAwesomeModule,
            ],
            declarations: declarations,
            exports: declarations
        })
    ], SharedModule);
    return SharedModule;
}());
exports.SharedModule = SharedModule;
