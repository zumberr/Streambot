import { switchMap } from 'rxjs/operators';
import { Streambot } from './discord/discord-bot';
import { Storage } from './storage/storage';
import environment from './environment.json';

Storage.init()
  .pipe(switchMap(() => Streambot.init(environment)))
  .subscribe();
