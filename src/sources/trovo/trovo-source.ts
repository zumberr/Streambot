import { Client, MessageOptions, TextChannel } from 'discord.js';
import moment from 'moment';
import fetch from 'node-fetch';
import { defer, EMPTY, interval, Observable, of, Subject, Subscription } from 'rxjs';
import { catchError, filter, map, switchMap, tap } from 'rxjs/operators';
import { DEV_STREAMER_INFO, StreamerInfo } from '../../discord/discord-bot.interface';
import { getNow } from '../../shared/utils';
import { Storage } from '../../storage/storage';
import {
  TrovoChannel,
  TrovoGetUsersResponse,
  TrovoSourceInitParams,
  TrovoSourceStreamChanges,
  TrovoSourceSubscriptions,
} from './trovo-source.interface';

export class TrovoSource {
  private static params: TrovoSourceInitParams;
  private static subscriptions: TrovoSourceSubscriptions = {};

  public static streamChanges: Subject<TrovoSourceStreamChanges> = new Subject();

  public static init(params: TrovoSourceInitParams) {
    this.params = params;
    return of(null).pipe(
      tap(() => {
        Object.values(Storage.settings.guilds).forEach((guild) => {
          const STREAMERS: StreamerInfo[] = [];
          // if (guild.devStreamEnabled) STREAMERS.push(DEV_STREAMER_INFO.trovo);
          STREAMERS.push(...Object.values(guild.sources.trovo));
          STREAMERS.forEach((streamer) => {
            this.setStreamerSubscription(guild.guildId, streamer.userId);
          });
          console.log(`[${getNow()}] [StreamBot] {Trovo} Subscribed to ${STREAMERS.length} channels on server ${guild.guildName}`);
        });
      }),
    );
  }

  public static addStreamers(guildId: string, displayNames: string[]): Observable<StreamerInfo[]> {
    const newStreamers: string[] = [];
    for (let displayName of displayNames) {
      const streamer = Object.values(Storage.settings.guilds[guildId].sources.trovo).find(
        (str) => str.displayName.toLowerCase() === displayName.toLowerCase(),
      );
      if (!streamer) newStreamers.push(displayName);
    }
    return this.getUsers(newStreamers).pipe(
      map((response) => {
        if (response === null) return [];
        return response.users
          .filter((user) => newStreamers.includes(user.username))
          .map((user) => ({ userId: user.channel_id, displayName: user.username }));
      }),
      tap((streamers) => {
        streamers.forEach((streamer) => {
          Storage.settings.guilds[guildId].sources.trovo[streamer.userId] = streamer;
          this.setStreamerSubscription(guildId, streamer.userId);
        });
        Storage.saveSettings();
      }),
    );
  }

  public static removeStreamers(guildId: string, displayNames: string[]): number {
    let removedStreamers: number = 0;
    for (let displayName of displayNames) {
      const streamer = Object.values(Storage.settings.guilds[guildId].sources.trovo).find(
        (str) => str.displayName.toLowerCase() === displayName.toLowerCase(),
      );
      if (streamer) {
        this.removeStreamerSubscription(guildId, streamer);
        delete Storage.settings.guilds[guildId].sources.trovo[streamer.userId];
        Storage.saveSettings();
        removedStreamers++;
      }
    }
    return removedStreamers;
  }

  public static subscribeToStreamChanges(client: Client) {
    return this.streamChanges
      .pipe(
        tap((streamChanges) => {
          const settings = Storage.settings.guilds[streamChanges.guildId];
          const channelId = settings.channelId;
          if (channelId) {
            defer(() => client.channels.fetch(channelId) as Promise<TextChannel>)
              .pipe(
                catchError(() => EMPTY),
                switchMap((channel) => {
                  const msgOptions: MessageOptions = {
                    content: settings.announcementMessage.replace('{DISPLAYNAME}', streamChanges.stream.username),
                    embed: {
                      title: streamChanges.stream.live_title,
                      description: streamChanges.stream.channel_url,
                      color: 0x30c07b,
                      timestamp: new Date(),
                      footer: {
                        text: streamChanges.stream.category_name,
                      },
                      author: {
                        name: streamChanges.stream.username,
                        url: streamChanges.stream.channel_url,
                        icon_url: streamChanges.stream.profile_pic,
                      },
                      thumbnail: {
                        url: streamChanges.stream.thumbnail,
                      },
                    },
                  };
                  const lastStreamMessageId = Storage.settings.guilds[streamChanges.guildId].sources.trovo[streamChanges.userId].lastStreamMessageId;
                  return lastStreamMessageId === undefined
                    ? channel.send(msgOptions)
                    : defer(() => channel.messages.fetch(lastStreamMessageId)).pipe(
                        catchError(() => of(null)),
                        switchMap((msg) => {
                          if (msg === null) return defer(() => channel.send(msgOptions));
                          const MESSAGE_TIMESTAMP = moment(msg.embeds[0].timestamp);
                          const THREE_HOURS_AGO = moment().subtract(6, 'hours');
                          return MESSAGE_TIMESTAMP.isAfter(THREE_HOURS_AGO)
                            ? defer(() => msg.edit(msgOptions))
                            : defer(() => channel.send(msgOptions));
                        }),
                      );
                }),
                tap((message) => {
                  if (!Array.isArray(message)) {
                    const streamer = Storage.settings.guilds[streamChanges.guildId].sources.trovo[streamChanges.userId];
                    streamer.lastStreamMessageId = message.id;
                    if (message.embeds[0].author?.name) {
                      streamer.displayName = message.embeds[0].author.name;
                    }
                    Storage.saveSettings();
                  }
                }),
              )
              .subscribe();
          }
        }),
      )
      .subscribe();
  }

  public static setStreamerSubscription(guildId: string, userId: string) {
    if (!this.subscriptions[guildId]) this.subscriptions[guildId] = {};
    let lastStream = { is_live: false, live_title: '', category_name: '' };
    this.subscriptions[guildId][userId] = interval(Storage.settings.trovo.interval * 60 * 1000)
      .pipe(
        switchMap(() => {
          return defer(() =>
            fetch('https://open-api.trovo.live/openplatform/channels/id', {
              method: 'POST',
              headers: {
                'Accept': 'application/json',
                'Client-ID': this.params.clientId,
              },
              body: JSON.stringify({ channel_id: userId }),
            }),
          ).pipe(switchMap((response) => defer(() => response.json()) as Observable<TrovoChannel>));
        }),
        filter((stream) => {
          const IS_LIVE = !lastStream.is_live && stream.is_live;
          const TITLE_CHANGED = stream.is_live && lastStream.live_title !== stream.live_title;
          const GAME_CHANGED = stream.is_live && lastStream.category_name !== stream.category_name;
          return IS_LIVE || TITLE_CHANGED || GAME_CHANGED;
        }),
        catchError(() => of(null)),
      )
      .subscribe((stream) => {
        if (stream === null) return;
        lastStream = { is_live: stream.is_live, live_title: stream.live_title, category_name: stream.category_name };
        this.streamChanges.next({ guildId, userId, stream });
      });
  }

  public static removeStreamerSubscription(guildId: string, streamer: StreamerInfo) {
    (this.subscriptions[guildId][streamer.userId] as Subscription).unsubscribe();
    delete this.subscriptions[guildId][streamer.userId];
  }

  private static getUsers(displayNames: string[]): Observable<TrovoGetUsersResponse | null> {
    return defer(() =>
      fetch('https://open-api.trovo.live/openplatform/getusers', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Client-ID': this.params.clientId,
        },
        body: JSON.stringify({ user: displayNames }),
      }),
    ).pipe(
      switchMap((response) => defer(() => response.json())),
      catchError(() => of(null)),
    );
  }
}
