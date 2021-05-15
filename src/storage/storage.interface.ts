import { GuildSettings } from '../discord/discord-bot.interface';

export interface Settings {
  adminUsers: string[];
  trovo: {
    interval: number;
  };
  guilds: {
    [key: string]: GuildSettings;
  };
}
