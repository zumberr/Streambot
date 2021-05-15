import moment from 'moment';

export function getNow(): string {
  return moment().format('YYYY-MM-DD HH:mm:ss.SSS');
}
