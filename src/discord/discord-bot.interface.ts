import { TwitchSourceInitParams } from '../sources/twitch/twitch-source.interface';
import { TrovoSourceInitParams } from '../sources/trovo/trovo-source.interface';

export interface StreambotInitParams {
  token: string;
  sources: {
    twitch: TwitchSourceInitParams;
    trovo: TrovoSourceInitParams;
  };
}

export interface GuildSettings {
  guildName: string;
  guildId: string;
  channelId?: string;
  announcementMessage: string;
  sources: Sources;
}

export type Source = 'twitch' | 'trovo';

export type Sources = {
  [key in Source]: StreamerList;
};

export interface StreamerList {
  [key: string]: StreamerInfo;
}

export interface StreamerInfo {
  userId: string;
  displayName: string;
  lastStreamMessageId?: string;
}
