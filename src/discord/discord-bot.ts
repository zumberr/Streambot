import { Client, Guild, Message, MessageReaction, PartialUser, User } from 'discord.js';
import { defaultsDeep } from 'lodash';
import { combineLatest } from 'rxjs';
import { tap } from 'rxjs/operators';
import { getNow } from '../shared/utils';
import { TrovoSource } from '../sources/trovo/trovo-source';
import { TwitchSource } from '../sources/twitch/twitch-source';
import { Storage } from '../storage/storage';
import { runCommand } from './discord-bot-commands';
import { GuildSettings, StreambotInitParams } from './discord-bot.interface';

export class Streambot {
  private static client: Client;

  public static init(params: StreambotInitParams) {
    this.client = new Client({
      partials: ['CHANNEL', 'MESSAGE', 'REACTION'],
      messageCacheMaxSize: 50,
      messageCacheLifetime: 60,
      messageSweepInterval: 300,
    });
    this.client.on('ready', this.onReady.bind(this));
    this.client.on('guildCreate', this.onGuildCreate.bind(this));
    this.client.on('guildDelete', this.onGuildDelete.bind(this));
    this.client.on('message', this.onMessage.bind(this));
    this.client.on('messageReactionAdd', this.onMessageReactionAdd.bind(this));
    this.client.on('messageReactionRemove', this.onMessageReactionRemove.bind(this));
    return combineLatest([
      this.client.login(params.token),
      TwitchSource.init(params.sources.twitch).pipe(
        tap(() => {
          TwitchSource.subscribeToStreamChanges(this.client);
        }),
      ),
      TrovoSource.init(params.sources.trovo).pipe(
        tap(() => {
          TrovoSource.subscribeToStreamChanges(this.client);
        }),
      ),
    ]);
  }

  private static onReady(): void {
    this.client.user?.setActivity(Storage.settings.botStatus, { type: 'PLAYING' });
    this.client.guilds.cache.forEach((guild) => {
      const settings = Storage.settings.guilds[guild.id];
      if (settings) {
        defaultsDeep(settings, this.getGuildSettings(guild));
        settings.guildName = guild.name;
      } else {
        Storage.settings.guilds[guild.id] = this.getGuildSettings(guild);
      }
    });
    Storage.saveSettings();
    console.log(`[${getNow()}] [Streambot] {Discord} Logged in as ${this.client.user?.tag}`);
  }

  private static onGuildCreate(guild: Guild): void {
    const settings = Storage.settings.guilds[guild.id];
    if (settings) {
      defaultsDeep(settings, this.getGuildSettings(guild));
      settings.guildName = guild.name;
    } else {
      Storage.settings.guilds[guild.id] = this.getGuildSettings(guild);
    }
    Storage.saveSettings();
  }

  private static onGuildDelete(guild: Guild): void {
    if (Storage.settings.guilds[guild.id]) {
      delete Storage.settings.guilds[guild.id];
    }
    Storage.saveSettings();
  }

  private static onMessage(message: Message): void {
    if (message.guild) {
      const PREFIX: string = '?';
      if (message.content.startsWith(PREFIX)) {
        const PARAMS = message.content.substring(PREFIX.length).split(' ');
        if (PARAMS.length) {
          runCommand(message, PARAMS);
        }
      }
    }
  }

  private static onMessageReactionAdd(reaction: MessageReaction, user: User | PartialUser): void {}

  private static onMessageReactionRemove(reaction: MessageReaction, user: User | PartialUser): void {}

  private static getGuildSettings(guild: Guild): GuildSettings {
    return {
      guildId: guild.id,
      guildName: guild.name,
      announcementMessage: '',
      sources: {
        twitch: {},
        trovo: {},
      },
    };
  }
}
