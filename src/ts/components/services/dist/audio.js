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
exports.Audio = void 0;
var core_1 = require("@angular/core");
var howler_1 = require("howler");
var lodash_1 = require("lodash");
var rev_1 = require("../../client/rev");
function getTracks(season, holiday, map) {
    switch (map) {
        case 1 /* Island */:
            return [
                'island',
                'sunny-island',
            ];
        case 2 /* House */:
            return [
                'happy-house',
                'sweet-home',
            ];
        case 3 /* Cave */:
            return [
                'cave-crystals',
                'cave-secrets',
            ];
        default:
            return __spreadArrays([
                //'largo',
                //'musicbox',
                //'unrest',
                'bossanova',
                'clop',
                'fivefour',
                'hypnosis',
                'scherzo',
                'trills',
                'waltzalt',
                'barkerrs',
                'gazan'
            ], (season === 4 /* Winter */ ? [
                'trees-winter',
                'reindeer-winter',
            ] : [
                'trees',
                'reindeer',
            ]), [
                'season',
                'ambient',
                'building',
                'school',
                'falling',
                'tio',
                'orchid'
            ], (season === 4 /* Winter */ ? [
                'xmas-air',
                'xmas-horns',
                'xmas-presents',
            ] : []), (holiday === 2 /* Halloween */ ? [
                'ghost',
                'pumpkin',
            ] : []));
    }
}
var FADE_TRACKS = true;
function fadeOut(track, id, volume) {
    var howl = track && track.howl;
    if (howl) {
        if (FADE_TRACKS) {
            howl
                .fade(volume, 0, 1000, id)
                .once('fade', function () { return howl.pause(id).stop(id); }, id);
        }
        else {
            howl
                .volume(0, id)
                .pause(id)
                .stop(id);
        }
    }
}
function fadeIn(track, id, volume) {
    if (track && track.howl) {
        track.howl.fade(0, volume, 1000, id);
    }
}
var Audio = /** @class */ (function () {
    function Audio() {
        this.tracks = [];
        this.volume = 0;
        this.loops = 0;
        this.playing = false;
        this.stopped = [];
        this.allTracks = [];
        this.handlingOnEnd = 0;
        this.handlingOnEndAt = 0;
    }
    Object.defineProperty(Audio.prototype, "trackName", {
        get: function () {
            return this.instance && this.volume ? this.instance.track.name : '';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Audio.prototype, "currentTrackIndex", {
        get: function () {
            var _this = this;
            return this.instance ? this.allTracks.findIndex(function (t) { return t === _this.instance.track; }) : -1;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Audio.prototype, "isPlaying", {
        get: function () {
            return this.playing;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Audio.prototype, "currentTime", {
        get: function () {
            if (this.instance) {
                var howl = this.instance.track.howl;
                if (howl) {
                    var seek = howl.seek(this.instance.id);
                    return typeof seek === 'number' ? seek : 0;
                }
            }
            return 0;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Audio.prototype, "duration", {
        get: function () {
            if (this.instance && this.instance.track.howl) {
                return this.instance.track.howl.duration();
            }
            return 0;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Audio.prototype, "progress", {
        get: function () {
            var dur = this.duration;
            return dur ? (this.currentTime / dur) * 100 : 0;
        },
        enumerable: false,
        configurable: true
    });
    Audio.prototype.initTracks = function (season, holiday, map) {
        var tracks = getTracks(season, holiday, map);
        this.allTracks = tracks.map(function (name) { return ({ name: name, src: [rev_1.getUrl("music/" + name + ".webm"), rev_1.getUrl("music/" + name + ".mp3")] }); });
        this.tracks = __spreadArrays(this.allTracks);
        this.loops = 0;
    };
    Audio.prototype.setVolume = function (volume) {
        this.volume = volume / 100;
        if (this.playing) {
            if (this.instance) {
                this.setInstanceVolume(this.instance, this.volume);
            }
            else if (this.volume) {
                this.playRandomTrack();
            }
        }
    };
    Audio.prototype.play = function () {
        try {
            if (!this.playing) {
                this.playing = true;
                if (this.volume) {
                    if (this.instance) {
                        this.resumeInstance(this.instance);
                    }
                    else {
                        this.playRandomTrack();
                    }
                }
            }
        }
        catch (e) {
            console.error(e);
        }
    };
    Audio.prototype.pause = function () {
        if (this.playing) {
            this.playing = false;
            if (this.instance && this.instance.track.howl) {
                this.instance.track.howl.pause(this.instance.id);
            }
        }
    };
    Audio.prototype.playOrSwitchToRandomTrack = function () {
        if (FADE_TRACKS) {
            if (this.playing && this.volume) {
                this.playRandomTrack();
            }
            else {
                this.play();
            }
        }
        else {
            this.play();
        }
    };
    Audio.prototype.stop = function () {
        if (this.playing) {
            this.playing = false;
            this.stopInstance(this.instance);
        }
    };
    Audio.prototype.forcePlay = function () {
        if (!this.instance || !this.instance.track.howl.playing(this.instance.id)) {
            this.playRandomTrack();
        }
    };
    Audio.prototype.touch = function () {
        this.stopInstances();
        this.setInstanceVolume(this.instance, this.volume);
    };
    Audio.prototype.switchToTrack = function (track) {
        if (this.instance && this.instance.track === track) {
            return false;
        }
        else {
            this.stopInstance(this.instance);
            this.instance = this.playTrack(track);
            return true;
        }
    };
    Audio.prototype.playRandomTrack = function () {
        while (!this.switchToTrack(lodash_1.sample(this.tracks)))
            ;
        this.loops = lodash_1.random(4, 7);
    };
    Audio.prototype.playNextTrack = function () {
        var currentIndex = this.currentTrackIndex;
        if (currentIndex >= 0 && currentIndex < this.allTracks.length - 1) {
            this.switchToTrack(this.allTracks[currentIndex + 1]);
        }
        else {
            this.playRandomTrack();
        }
    };
    Audio.prototype.playPreviousTrack = function () {
        var currentIndex = this.currentTrackIndex;
        if (currentIndex > 0) {
            this.switchToTrack(this.allTracks[currentIndex - 1]);
        }
        else {
            this.playRandomTrack();
        }
    };
    Audio.prototype.playTrack = function (track) {
        this.prepareTrack(track);
        var id = track.howl.play();
        fadeIn(track, id, this.volume);
        return { id: id, track: track };
    };
    Audio.prototype.resumeInstance = function (_a) {
        var track = _a.track, id = _a.id;
        track.howl.play(id);
        fadeIn(track, id, this.volume);
    };
    Audio.prototype.stopInstance = function (instance) {
        if (instance) {
            this.stopped.push(instance);
        }
        this.stopInstances();
    };
    Audio.prototype.stopInstances = function () {
        var _this = this;
        this.stopped.forEach(function (_a) {
            var track = _a.track, id = _a.id;
            return fadeOut(track, id, _this.volume);
        });
        this.stopped = this.stopped.filter(function (_a) {
            var track = _a.track, id = _a.id;
            return track.howl.playing(id);
        });
    };
    Audio.prototype.setInstanceVolume = function (instance, volume) {
        if (instance) {
            var howl = instance.track.howl;
            howl.volume(volume, instance.id);
            if (volume && !howl.playing(instance.id)) {
                howl.play(instance.id);
            }
            else if (!volume && howl.playing(instance.id)) {
                howl.pause(instance.id);
            }
        }
    };
    Audio.prototype.seekTo = function (seconds) {
        if (this.instance && this.instance.track.howl && typeof seconds === 'number' && isFinite(seconds)) {
            this.instance.track.howl.seek(Math.max(0, seconds), this.instance.id);
        }
    };
    Audio.prototype.prepareTrack = function (track) {
        var _this = this;
        if (!track.howl) {
            track.howl = new howler_1.Howl({
                src: track.src,
                loop: true,
                html5: true
            });
            track.howl.on('end', function (id) { return _this.onEnd(id); });
        }
    };
    Audio.prototype.onEnd = function (id) {
        if (this.instance && this.instance.id === id && --this.loops < 0 &&
            (this.handlingOnEnd !== id || this.handlingOnEndAt < performance.now())) {
            this.handlingOnEnd = id;
            this.handlingOnEndAt = performance.now() + 500;
            if (this.volume && this.playing) {
                this.playRandomTrack();
            }
            else {
                this.stopInstance(this.instance);
            }
        }
    };
    Audio = __decorate([
        core_1.Injectable({ providedIn: 'root' })
    ], Audio);
    return Audio;
}());
exports.Audio = Audio;
