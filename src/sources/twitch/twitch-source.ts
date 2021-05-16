import { combineLatest, defer, EMPTY, from, of, Subject } from 'rxjs';
import { catchError, map, switchMap, take, tap } from 'rxjs/operators';
import { ApiClient, ClientCredentialsAuthProvider } from 'twitch';
import { SimpleAdapter, Subscription, WebHookListener } from 'twitch-webhooks';
import { getNow } from '../../shared/utils';
import { TwitchSourceInitParams, TwitchSourceStreamChanges, TwitchSourceSubscriptions } from './twitch-source.interface';
import { Storage } from '../../storage/storage';
import { StreamerInfo } from '../../discord/discord-bot.interface';
import { Client, MessageOptions, TextChannel } from 'discord.js';
import moment from 'moment';

export class TwitchSource {
  private static apiClient: ApiClient;
  private static webHookListener: WebHookListener;
  private static subscriptions: TwitchSourceSubscriptions = {};

  public static streamChanges: Subject<TwitchSourceStreamChanges> = new Subject();

  public static init(params: TwitchSourceInitParams) {
    const { clientId, clientSecret, hostName, listenerPort } = params;
    const authProvider = new ClientCredentialsAuthProvider(clientId, clientSecret);
    const simpleAdapter = new SimpleAdapter({ hostName, listenerPort });
    this.apiClient = new ApiClient({ authProvider });
    this.webHookListener = new WebHookListener(this.apiClient, simpleAdapter);
    return defer(() => this.webHookListener.listen()).pipe(
      tap(() => {
        console.log(`[${getNow()}] [Streambot] {Twitch} Listening`);
      }),
      tap(() => {
        Object.values(Storage.settings.guilds).forEach((guild) => {
          Object.values(guild.sources.twitch).forEach((streamer) => {
            this.setStreamerSubscription(guild.guildId, streamer.userId);
          });
          console.log(
            `[${getNow()}] [StreamBot] {Twitch} Subscribed to ${Object.values(guild.sources.twitch).length} channels on server ${guild.guildName}`,
          );
        });
      }),
    );
  }

  public static addStreamers(guildId: string, displayNames: string[]) {
    const newStreamers = [];
    for (let displayName of displayNames) {
      const streamer = Object.values(Storage.settings.guilds[guildId].sources.twitch).find(
        (str) => str.displayName.toLowerCase() === displayName.toLowerCase(),
      );
      if (!streamer) newStreamers.push(this.getUser(displayName));
    }
    return combineLatest(newStreamers).pipe(
      take(1),
      map((streamers) => streamers.filter((streamer) => streamer !== null) as StreamerInfo[]),
      tap((streamers) => {
        streamers.forEach((streamer) => {
          Storage.settings.guilds[guildId].sources.twitch[streamer.userId] = streamer;
          Storage.saveSettings();
          this.setStreamerSubscription(guildId, streamer.userId);
        });
      }),
    );
  }

  public static removeStreamers(guildId: string, displayNames: string[]) {
    const removeStreamers = [];
    for (let displayName of displayNames) {
      const streamer = Object.values(Storage.settings.guilds[guildId].sources.twitch).find(
        (str) => str.displayName.toLowerCase() === displayName.toLowerCase(),
      );
      if (streamer) {
        removeStreamers.push(
          defer(() => (this.subscriptions[guildId][streamer.userId] as Subscription).stop()).pipe(
            tap(() => {
              delete this.subscriptions[guildId][streamer.userId];
              delete Storage.settings.guilds[guildId].sources.twitch[streamer.userId];
              Storage.saveSettings();
            }),
          ),
        );
      }
    }
    return combineLatest(removeStreamers);
  }

  public static subscribeToStreamChanges(client: Client) {
    return this.streamChanges
      .pipe(
        tap((streamChanges) => {
          const channelId = Storage.settings.guilds[streamChanges.guildId].channelId;
          if (channelId) {
            combineLatest([
              defer(() => streamChanges.stream.getUser()),
              defer(() => streamChanges.stream.getGame()),
              defer(() => client.channels.fetch(channelId) as Promise<TextChannel>),
            ])
              .pipe(
                catchError(() => EMPTY),
                switchMap(([user, game, channel]) => {
                  const msgOptions: MessageOptions = {
                    content: `¡**${user?.displayName}** prendió stream!`,
                    embed: {
                      title: streamChanges.stream.title,
                      description: `https://www.twitch.tv/${user?.displayName}`,
                      color: 0x9147ff,
                      timestamp: new Date(),
                      footer: {
                        text: game?.name,
                      },
                      author: {
                        name: streamChanges.stream.userDisplayName,
                        url: `https://www.twitch.tv/${user?.displayName}`,
                        icon_url: user?.profilePictureUrl,
                      },
                      thumbnail: {
                        url: streamChanges.stream.thumbnailUrl.replace('{width}', '320').replace('{height}', '180'),
                      },
                    },
                  };
                  const lastStreamMessageId = Storage.settings.guilds[streamChanges.guildId].sources.twitch[streamChanges.userId].lastStreamMessageId;
                  return lastStreamMessageId === undefined
                    ? channel.send(msgOptions)
                    : defer(() => channel.messages.fetch(lastStreamMessageId)).pipe(
                        catchError(() => of(null)),
                        switchMap((msg) => {
                          if (msg === null) return defer(() => channel.send(msgOptions));
                          const MESSAGE_TIMESTAMP = moment(msg.embeds[0].timestamp);
                          const THREE_HOURS_AGO = moment().subtract(3, 'hours');
                          return MESSAGE_TIMESTAMP.isAfter(THREE_HOURS_AGO)
                            ? defer(() => msg.edit(msgOptions))
                            : defer(() => channel.send(msgOptions));
                        }),
                      );
                }),
                tap((message) => {
                  if (!Array.isArray(message)) {
                    const streamer = Storage.settings.guilds[streamChanges.guildId].sources.twitch[streamChanges.userId];
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

  private static setStreamerSubscription(guildId: string, userId: string) {
    from(
      this.webHookListener.subscribeToStreamChanges(userId, (stream) => {
        if (stream) this.streamChanges.next({ guildId, userId, stream });
      }),
    ).subscribe((subscription) => {
      if (!this.subscriptions[guildId]) this.subscriptions[guildId] = {};
      this.subscriptions[guildId][userId] = subscription;
    });
  }

  private static getUser(userName: string) {
    return defer(() => this.apiClient.helix.users.getUserByName(userName)).pipe(
      map((user) => {
        if (user) {
          return { userId: user.id, displayName: user.displayName };
        } else return null;
      }),
    );
  }
}
