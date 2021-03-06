import { Guild, Message } from 'discord.js';
import { defer } from 'rxjs';
import { combineLatest } from 'rxjs';
import { TrovoSource } from '../sources/trovo/trovo-source';
import { TwitchSource } from '../sources/twitch/twitch-source';
import { Storage } from '../storage/storage';
import { DEV_STREAMER_INFO } from './discord-bot.interface';

export function runCommand(message: Message, params: string[]) {
  if (params.length) {
    switch (params.shift()) {
      case 'setmessage':
        if (!hasPermission(message)) return commandResult(message, 'FAIL');
        if (message.guild) {
          Storage.settings.guilds[message.guild.id].announcementMessage = params.join(' ');
          Storage.saveSettings();
          commandResult(message, 'SUCCESS');
        } else commandResult(message, 'FAIL');
        break;
      case 'setchannel':
        if (!hasPermission(message)) return commandResult(message, 'FAIL');
        if (message.guild) {
          Storage.settings.guilds[message.guild.id].channelId = message.channel.id;
          Storage.saveSettings();
          commandResult(message, 'SUCCESS');
        } else commandResult(message, 'FAIL');
        break;
      case 'streamerlist':
        if (message.guild) {
          const SOURCES = Object.entries(Storage.settings.guilds[message.guild.id].sources).map(
            ([name, source]) =>
              `${capitalize(name)}: ${Object.values(source)
                .map((streamer) => sanitize(streamer.displayName))
                .join(', ')}`,
          );
          message.channel.send(`Channels:\n${SOURCES.join('\n')}`);
        } else commandResult(message, 'FAIL');
        break;
      case 'addstreamers':
        if (!hasPermission(message)) return commandResult(message, 'FAIL');
        if (message.guild && params.length > 1) {
          switch (params.shift()) {
            case 'twitch':
              TwitchSource.addStreamers(message.guild.id, params).subscribe((streamers) => {
                message.channel.send(`Added ${streamers.length} Twitch channel${streamers.length === 1 ? '' : 's'}`);
              });
              break;
            case 'trovo':
              TrovoSource.addStreamers(message.guild.id, params).subscribe((streamers) => {
                message.channel.send(`Added ${streamers.length} Trovo channel${streamers.length === 1 ? '' : 's'}`);
              });
              break;
            default:
              commandResult(message, 'FAIL');
          }
        } else commandResult(message, 'FAIL');
        break;
      case 'delstreamers':
        if (!hasPermission(message)) return commandResult(message, 'FAIL');
        if (message.guild && params.length > 1) {
          switch (params.shift()) {
            case 'twitch':
              TwitchSource.removeStreamers(message.guild.id, params).subscribe((streamers) => {
                message.channel.send(`Removed ${streamers.length} Twitch channel${streamers.length === 1 ? '' : 's'}`);
              });
              break;
            case 'trovo':
              const delstreamers_trovo_ammount = TrovoSource.removeStreamers(message.guild.id, params);
              message.channel.send(`Removed ${delstreamers_trovo_ammount} Trovo channel${delstreamers_trovo_ammount === 1 ? '' : 's'}`);
              break;
            default:
              commandResult(message, 'FAIL');
          }
        } else commandResult(message, 'FAIL');
        break;
      case 'toggledevstream':
        if (!hasPermission(message, true)) return commandResult(message, 'FAIL');
        if (message.guild) {
          if (isDevStreamEnabled(message.guild)) {
            TwitchSource.removeStreamerSubscription(message.guild.id, DEV_STREAMER_INFO.twitch).subscribe();
            TrovoSource.removeStreamerSubscription(message.guild.id, DEV_STREAMER_INFO.trovo);
          } else {
            TwitchSource.setStreamerSubscription(message.guild.id, DEV_STREAMER_INFO.twitch.userId);
            TrovoSource.setStreamerSubscription(message.guild.id, DEV_STREAMER_INFO.trovo.displayName);
          }
          Storage.settings.guilds[message.guild.id].devStreamEnabled = !isDevStreamEnabled(message.guild);
          Storage.saveSettings();
          commandResult(message, 'SUCCESS');
        } else commandResult(message, 'FAIL');
        break;
    }
  }
}

function hasPermission(message: Message, devOnly: boolean = false): boolean {
  const GUILD_ADMIN = Boolean(message.member && message.member.hasPermission('ADMINISTRATOR'));
  const BOT_DEV = Boolean(message.member && Storage.settings.adminUsers.includes(message.member.id));
  return devOnly ? BOT_DEV : GUILD_ADMIN || BOT_DEV;
}

function isDevStreamEnabled(guild: Guild): boolean {
  return Storage.settings.guilds[guild.id].devStreamEnabled;
}

function commandResult(message: Message, type: 'SUCCESS' | 'FAIL') {
  switch (type) {
    case 'SUCCESS':
      defer(() => message.react('???')).subscribe();
      break;
    case 'FAIL':
    default:
      defer(() => message.react('???')).subscribe();
  }
}

export function sanitize(text: string): string {
  const unescaped = text.replace(/\\(\*|_|`|~|\\)/g, '$1');
  const escaped = unescaped.replace(/(\*|_|`|~|\\)/g, '\\$1');
  return escaped;
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
