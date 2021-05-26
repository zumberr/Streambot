import { GuildSettings } from '../discord/discord-bot.interface';

export interface Settings {
  botStatus: string;
  adminUsers: string[];
  trovo: {
    interval: number;
  };
  guilds: {
    [key: string]: GuildSettings;
  };
}
