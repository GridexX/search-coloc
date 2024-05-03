import {Command} from 'commander';
import {postAnnounce} from '../lib';
import {NotionAnnounce} from '../lib/types';

const program = new Command();

program
  .name('Search-coloc')
  .description('CLI to help you finding a flat share.')
  .version('0.1.0');

program
  .command('post')
  .description("Post the Apartment's announce to Notion")
  .requiredOption('-u, --url <link>', 'The link of the announce')
  .requiredOption('-a, --address <address>', 'The address of the apartment')
  .requiredOption('-re, --rent <rent>', 'The rent in € of the apartment')
  .requiredOption('-s, --surface <surface>', 'The surface of the apartment')
  .requiredOption('-rs, --roomSurface <roomSurface>', "The room's surface")
  .requiredOption(
    '-ro, --rooms <rooms>',
    'The number of rooms in the apartment'
  )
  .option('-c, --caution <caution>', 'The caution in €', '0')
  .option('-f, --fees <fees>', 'Additional fees in €', '0')
  .option('-g, --local <local>', 'If there is a local or a garage', 'false')
  .option('-l, --living <living>', 'If there is a living room', 'false')
  .option(
    '-t, --terrace <terrace>',
    'If there is a terrace or a balcon',
    'false'
  )
  .option('-n, --notes <notes>', 'Notes about the apartment', '')
  .action(options => {
    const {
      url,
      notes,
      address,
      rent,
      surface,
      roomSurface,
      rooms,
      caution,
      fees,
      local,
      living,
      terrace,
    } = options;
    const announce: NotionAnnounce = {
      url,
      address,
      notes,
      rent: parseInt(rent),
      surface: parseInt(surface),
      roomSurface: parseInt(roomSurface),
      rooms: parseInt(rooms),
      caution: parseInt(caution),
      fees: parseInt(fees),
      local: local === 'true',
      living: living === 'true',
      terrace: terrace === 'true',
    };
    postAnnounce(announce);
  });

program.command('extract').description('Extract the announces from the mails');

program.parse();
